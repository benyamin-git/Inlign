//! Line-by-line prefix evaluator.

use std::collections::{BTreeMap, BTreeSet};

use crate::ast::{BinOp, Equation, Expr};
use crate::format::{Suggestion, approx_eq, format_set, format_value, suggestion_for};
use crate::parser::{ParseOutcome, parse};
use crate::solver::{
    AddOutcome, LinearForm, LinearSystem, LinearizeOutcome, UnivariateOutcome, linearize,
    solve_univariate,
};

/// One notebook line as the evaluator sees it.
#[derive(Debug, Clone, PartialEq)]
pub struct InputLine {
    pub id: String,
    pub text: String,
}

/// The outcome of evaluating one line.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LineStatus {
    Ok,
    Empty,
    Incomplete,
    Error,
    Skipped,
}

/// The derived annotation for one line.
#[derive(Debug, Clone, PartialEq)]
pub struct LineEvaluation {
    pub id: String,
    pub status: LineStatus,
    pub suggestion: Option<Suggestion>,
    pub error: Option<String>,
}

/// Evaluates a notebook prefix in order.
pub fn evaluate(lines: &[InputLine]) -> Vec<LineEvaluation> {
    let mut state = State::default();
    let mut stopped = false;
    let mut results = Vec::with_capacity(lines.len());

    for line in lines {
        if stopped {
            results.push(LineEvaluation {
                id: line.id.clone(),
                status: LineStatus::Skipped,
                suggestion: None,
                error: None,
            });
            continue;
        }

        let text = line.text.trim();
        let (status, suggestion, error) = if text.is_empty() {
            (LineStatus::Empty, None, None)
        } else {
            match parse(text) {
                Err(_) => (LineStatus::Error, None, Some("invalid".to_owned())),
                Ok(ParseOutcome::Incomplete(incomplete)) => {
                    let suggestion = incomplete
                        .assignment
                        .as_deref()
                        .and_then(|name| state.suggestion(name));
                    (LineStatus::Incomplete, suggestion, None)
                }
                Ok(ParseOutcome::Equation(equation)) => match state.process_line(&equation) {
                    Ok(()) => (LineStatus::Ok, None, None),
                    Err(error) => (LineStatus::Error, None, Some(error)),
                },
            }
        };

        if status == LineStatus::Error {
            stopped = true;
        }
        results.push(LineEvaluation {
            id: line.id.clone(),
            status,
            suggestion,
            error,
        });
    }

    results
}

#[derive(Debug, Clone, PartialEq)]
enum Value {
    Single(f64),
    Set(Vec<f64>),
}

#[derive(Clone)]
struct Constraint {
    equation: Equation,
    applied: bool,
}

#[derive(Clone, Default)]
struct State {
    values: BTreeMap<String, Value>,
    linear: LinearSystem,
    constraints: Vec<Constraint>,
    pending: Vec<Equation>,
}

enum ApplyOutcome {
    Applied,
    Pending,
    Error(String),
}

enum BranchOutcome {
    Applied,
    Blocked,
}

impl State {
    fn singles(&self) -> BTreeMap<String, f64> {
        self.values
            .iter()
            .filter_map(|(name, value)| match value {
                Value::Single(value) => Some((name.clone(), *value)),
                Value::Set(_) => None,
            })
            .collect()
    }

    fn known(&self, name: &str) -> Option<f64> {
        match self.values.get(name) {
            Some(Value::Single(value)) => Some(*value),
            _ => None,
        }
    }

    fn set(&self, name: &str) -> Option<&[f64]> {
        match self.values.get(name) {
            Some(Value::Set(values)) => Some(values),
            _ => None,
        }
    }

    fn is_set(&self, name: &str) -> bool {
        matches!(self.values.get(name), Some(Value::Set(_)))
    }

    fn set_entry(&self) -> Option<(&str, &[f64])> {
        self.values.iter().find_map(|(name, value)| match value {
            Value::Set(values) => Some((name.as_str(), values.as_slice())),
            Value::Single(_) => None,
        })
    }

    fn refresh(&mut self) -> Result<(), String> {
        let determined = self.linear.values();
        let mut reconciled = BTreeMap::new();

        for (name, value) in &self.values {
            let Value::Set(set) = value else {
                continue;
            };
            match determined.get(name) {
                Some(determined_value) => {
                    if set
                        .iter()
                        .any(|candidate| approx_eq(*candidate, *determined_value))
                    {
                        reconciled.insert(name.clone(), Value::Single(*determined_value));
                    } else {
                        return Err(format!("{name} = {}", format_set(set)));
                    }
                }
                None => {
                    reconciled.insert(name.clone(), Value::Set(set.clone()));
                }
            }
        }

        for (name, value) in determined {
            reconciled.entry(name).or_insert(Value::Single(value));
        }
        self.values = reconciled;
        Ok(())
    }

    fn suggestion(&self, name: &str) -> Option<Suggestion> {
        if let Some((_, set)) = self.set_entry().filter(|(set_name, _)| *set_name == name) {
            return suggestion_for(set);
        }
        match self.values.get(name) {
            Some(Value::Single(value)) => suggestion_for(&[*value]),
            _ => None,
        }
    }

    fn record(&mut self, equation: &Equation, applied: bool) {
        self.constraints.push(Constraint {
            equation: equation.clone(),
            applied,
        });
    }

    fn mark_applied(&mut self, equation: &Equation) {
        if let Some(constraint) = self
            .constraints
            .iter_mut()
            .find(|constraint| !constraint.applied && constraint.equation == *equation)
        {
            constraint.applied = true;
        }
    }

    fn add_pending(&mut self, equation: &Equation) {
        if !self.pending.contains(equation) {
            self.pending.push(equation.clone());
        }
    }

    fn process_line(&mut self, equation: &Equation) -> Result<(), String> {
        let count = plus_minus_count(equation);
        if count == 0 {
            return self.apply_line(equation, true);
        }
        if count > 2 {
            return Ok(());
        }
        if !self.plus_minus_operands_are_single(equation) {
            return self.apply_line(equation, true);
        }
        match self.apply_branches(equation, true)? {
            BranchOutcome::Applied => {
                self.record(equation, true);
                Ok(())
            }
            BranchOutcome::Blocked => {
                self.record(equation, false);
                self.add_pending(equation);
                Ok(())
            }
        }
    }

    fn plus_minus_operands_are_single(&self, equation: &Equation) -> bool {
        let singles = self.singles();
        expression_operands_are_single(&equation.left, &singles)
            && expression_operands_are_single(&equation.right, &singles)
    }

    fn retry_equation(&mut self, equation: &Equation) -> ApplyOutcome {
        let count = plus_minus_count(equation);
        if count > 0 && count <= 2 && self.plus_minus_operands_are_single(equation) {
            return match self.apply_branches(equation, false) {
                Ok(BranchOutcome::Applied) => ApplyOutcome::Applied,
                Ok(BranchOutcome::Blocked) => ApplyOutcome::Pending,
                Err(error) => ApplyOutcome::Error(error),
            };
        }
        self.apply_equation(equation)
    }

    fn apply_branches(
        &mut self,
        equation: &Equation,
        recheck: bool,
    ) -> Result<BranchOutcome, String> {
        let branches = expand_plus_minus(equation, 2).expect("plus-minus count checked");
        let mut survivors = Vec::new();
        let mut errors = Vec::new();

        for branch in &branches {
            let mut trial = self.clone();
            match trial.apply_line(branch, recheck) {
                Ok(()) => survivors.push(trial),
                Err(error) => errors.push(error),
            }
        }

        if survivors.is_empty() {
            return Err(self.branch_failure(equation, &errors));
        }
        if survivors.len() == 1 {
            *self = survivors.pop().expect("one survivor");
            return Ok(BranchOutcome::Applied);
        }

        self.merge_branches(&survivors, recheck)
    }

    fn merge_branches(
        &mut self,
        survivors: &[State],
        recheck: bool,
    ) -> Result<BranchOutcome, String> {
        let mut changed = BTreeSet::new();
        for branch in survivors {
            for (name, value) in &branch.values {
                if self.values.get(name) != Some(value) {
                    changed.insert(name.clone());
                }
            }
            for name in self.values.keys() {
                if !branch.values.contains_key(name) {
                    changed.insert(name.clone());
                }
            }
        }

        if changed.len() != 1 {
            return Ok(BranchOutcome::Applied);
        }

        let name = changed.into_iter().next().expect("one changed variable");
        let union = branch_union(survivors, &name);

        match self.values.get(&name).cloned() {
            Some(Value::Single(value)) => {
                if union.iter().any(|candidate| approx_eq(*candidate, value)) {
                    Ok(BranchOutcome::Applied)
                } else {
                    Err(format!("{name} = {}", format_value(value)))
                }
            }
            Some(Value::Set(set)) => {
                let intersection: Vec<f64> = set
                    .iter()
                    .copied()
                    .filter(|value| union.iter().any(|candidate| approx_eq(*candidate, *value)))
                    .collect();
                if intersection.is_empty() {
                    return Err(format!("{name} = {}", format_set(&set)));
                }
                if intersection.len() == 1 {
                    self.set_single(&name, intersection[0])?;
                } else {
                    self.values.insert(name.clone(), Value::Set(intersection));
                }
                if recheck {
                    self.recheck_pending()?;
                }
                Ok(BranchOutcome::Applied)
            }
            None => {
                if union.len() > 1 {
                    if self.set_entry().is_some() {
                        return Ok(BranchOutcome::Blocked);
                    }
                    self.values.insert(name.clone(), Value::Set(union));
                    if recheck {
                        self.recheck_pending()?;
                    }
                    return Ok(BranchOutcome::Applied);
                }
                if union.len() == 1 {
                    self.set_single(&name, union[0])?;
                    if recheck {
                        self.recheck_pending()?;
                    }
                }
                Ok(BranchOutcome::Applied)
            }
        }
    }

    fn set_single(&mut self, name: &str, value: f64) -> Result<(), String> {
        self.values.insert(name.to_owned(), Value::Single(value));
        let form = LinearForm {
            coeffs: BTreeMap::from([(name.to_owned(), 1.0)]),
            constant: -value,
        };
        match self.linear.add(form) {
            AddOutcome::Consistent => self.refresh(),
            AddOutcome::Inconsistent => Err("false".to_owned()),
        }
    }

    fn branch_failure(&self, equation: &Equation, errors: &[String]) -> String {
        if let Some(first) = errors.first() {
            let hard = first == "÷ 0" || first == "invalid";
            if hard && errors.iter().all(|error| error == first) {
                return first.clone();
            }
        }
        if let Some(name) = direct_target(equation) {
            if let Some(value) = self.known(name) {
                return format!("{name} = {}", format_value(value));
            }
            if let Some(set) = self.set(name) {
                return format!("{name} = {}", format_set(set));
            }
        }
        "false".to_owned()
    }

    fn apply_line(&mut self, equation: &Equation, recheck: bool) -> Result<(), String> {
        match self.apply_equation(equation) {
            ApplyOutcome::Applied => self.record(equation, true),
            ApplyOutcome::Pending => {
                self.record(equation, false);
                self.add_pending(equation);
            }
            ApplyOutcome::Error(error) => return Err(error),
        }
        if recheck {
            self.recheck_pending()?;
        }
        Ok(())
    }

    fn recheck_pending(&mut self) -> Result<(), String> {
        for _ in 0..64 {
            let before = self.values.clone();
            let pending = std::mem::take(&mut self.pending);
            let mut remaining = Vec::with_capacity(pending.len());

            for equation in pending {
                match self.retry_equation(&equation) {
                    ApplyOutcome::Applied => self.mark_applied(&equation),
                    ApplyOutcome::Pending => remaining.push(equation),
                    ApplyOutcome::Error(error) => return Err(error),
                }
            }

            self.pending = remaining;
            if self.values == before {
                break;
            }
        }
        Ok(())
    }

    fn apply_equation(&mut self, equation: &Equation) -> ApplyOutcome {
        let difference = difference(equation);
        let outcome = linearize(&difference, &self.singles());

        match &outcome {
            LinearizeOutcome::DivisionByZero => {
                return ApplyOutcome::Error("÷ 0".to_owned());
            }
            LinearizeOutcome::NonFinite => {
                return ApplyOutcome::Error("invalid".to_owned());
            }
            _ => {}
        }

        if let Some(result) = self.direct_assignment(equation) {
            return result;
        }

        match outcome {
            LinearizeOutcome::Numeric(value) => {
                if approx_eq(value, 0.0) {
                    ApplyOutcome::Applied
                } else {
                    ApplyOutcome::Error("false".to_owned())
                }
            }
            LinearizeOutcome::Linear(form) => self.apply_linear(form),
            LinearizeOutcome::Nonlinear => self.apply_nonlinear(equation, &difference),
            LinearizeOutcome::DivisionByZero => ApplyOutcome::Error("÷ 0".to_owned()),
            LinearizeOutcome::NonFinite => ApplyOutcome::Error("invalid".to_owned()),
        }
    }

    fn apply_linear(&mut self, form: LinearForm) -> ApplyOutcome {
        let set_name = form.coeffs.keys().find(|name| self.is_set(name)).cloned();

        match set_name {
            Some(_) if form.coeffs.len() > 1 => ApplyOutcome::Pending,
            Some(name) => {
                let coefficient = form.coeffs[&name];
                let value = -form.constant / coefficient;
                self.narrow_set(&name, value, form)
            }
            None => match self.linear.add(form) {
                AddOutcome::Consistent => match self.refresh() {
                    Ok(()) => ApplyOutcome::Applied,
                    Err(error) => ApplyOutcome::Error(error),
                },
                AddOutcome::Inconsistent => ApplyOutcome::Error("false".to_owned()),
            },
        }
    }

    fn narrow_set(&mut self, name: &str, value: f64, form: LinearForm) -> ApplyOutcome {
        let Some(set) = self.set(name) else {
            return ApplyOutcome::Error("false".to_owned());
        };
        if !set.iter().any(|candidate| approx_eq(*candidate, value)) {
            return ApplyOutcome::Error(format!("{name} = {}", format_set(set)));
        }

        self.values.insert(name.to_owned(), Value::Single(value));
        match self.linear.add(form) {
            AddOutcome::Consistent => {}
            AddOutcome::Inconsistent => return ApplyOutcome::Error("false".to_owned()),
        }
        match self.refresh() {
            Ok(()) => ApplyOutcome::Applied,
            Err(error) => ApplyOutcome::Error(error),
        }
    }

    fn direct_assignment(&mut self, equation: &Equation) -> Option<ApplyOutcome> {
        if let Some(result) = self.direct_side(&equation.left, &equation.right) {
            return Some(result);
        }
        self.direct_side(&equation.right, &equation.left)
    }

    fn direct_side(&mut self, target: &Expr, other: &Expr) -> Option<ApplyOutcome> {
        let Expr::Var(name) = target else {
            return None;
        };
        let value = self.evaluate_side(other)?;

        if let Some(known) = self.known(name) {
            return Some(if approx_eq(value, known) {
                ApplyOutcome::Applied
            } else {
                ApplyOutcome::Error(format!("{name} = {}", format_value(known)))
            });
        }

        if self.is_set(name) {
            let form = LinearForm {
                coeffs: BTreeMap::from([(name.clone(), 1.0)]),
                constant: -value,
            };
            return Some(self.narrow_set(name, value, form));
        }

        None
    }

    fn evaluate_side(&self, expr: &Expr) -> Option<f64> {
        match linearize(expr, &self.singles()) {
            LinearizeOutcome::Numeric(value) => Some(value),
            _ => None,
        }
    }

    fn apply_nonlinear(&mut self, equation: &Equation, difference: &Expr) -> ApplyOutcome {
        if mentions_set(equation, self) {
            return ApplyOutcome::Pending;
        }

        let unknowns = unknown_variables(equation, &self.values);
        if unknowns.len() != 1 {
            return ApplyOutcome::Pending;
        }
        let variable = unknowns.into_iter().next().expect("one unknown");

        match solve_univariate(difference, &variable, &self.singles()) {
            UnivariateOutcome::Roots(roots) => {
                let roots = normalized_roots(roots);
                match roots.as_slice() {
                    [] => ApplyOutcome::Error("false".to_owned()),
                    [root] => {
                        let form = LinearForm {
                            coeffs: BTreeMap::from([(variable, 1.0)]),
                            constant: -*root,
                        };
                        match self.linear.add(form) {
                            AddOutcome::Consistent => match self.refresh() {
                                Ok(()) => ApplyOutcome::Applied,
                                Err(error) => ApplyOutcome::Error(error),
                            },
                            AddOutcome::Inconsistent => ApplyOutcome::Error("false".to_owned()),
                        }
                    }
                    _ => {
                        if self.set_entry().is_some() {
                            return ApplyOutcome::Pending;
                        }
                        self.values.insert(variable, Value::Set(roots));
                        ApplyOutcome::Applied
                    }
                }
            }
            UnivariateOutcome::NoRealRoots => ApplyOutcome::Error("false".to_owned()),
            UnivariateOutcome::Identity => ApplyOutcome::Applied,
            UnivariateOutcome::Unsolved => ApplyOutcome::Pending,
            UnivariateOutcome::DivisionByZero => ApplyOutcome::Error("÷ 0".to_owned()),
            UnivariateOutcome::NonFinite => ApplyOutcome::Error("invalid".to_owned()),
        }
    }
}

fn difference(equation: &Equation) -> Expr {
    Expr::Binary {
        op: BinOp::Sub,
        left: Box::new(equation.left.clone()),
        right: Box::new(equation.right.clone()),
    }
}

fn mentions_set(equation: &Equation, state: &State) -> bool {
    expression_mentions_set(&equation.left, state)
        || expression_mentions_set(&equation.right, state)
}

fn expression_mentions_set(expr: &Expr, state: &State) -> bool {
    match expr {
        Expr::Number(_) => false,
        Expr::Var(name) => state.is_set(name),
        Expr::Neg(inner) | Expr::PlusMinus(inner) => expression_mentions_set(inner, state),
        Expr::Binary { left, right, .. } => {
            expression_mentions_set(left, state) || expression_mentions_set(right, state)
        }
    }
}

fn normalized_roots(values: Vec<f64>) -> Vec<f64> {
    let mut sorted = values;
    sorted.sort_by(|a, b| b.total_cmp(a));
    let mut result: Vec<f64> = Vec::new();
    for value in sorted {
        if result.last().is_none_or(|last| !approx_eq(*last, value)) {
            result.push(value);
        }
    }
    result
}

fn plus_minus_count(equation: &Equation) -> usize {
    expression_plus_minus_count(&equation.left) + expression_plus_minus_count(&equation.right)
}

fn expression_plus_minus_count(expr: &Expr) -> usize {
    match expr {
        Expr::PlusMinus(inner) => 1 + expression_plus_minus_count(inner),
        Expr::Neg(inner) => expression_plus_minus_count(inner),
        Expr::Binary { left, right, .. } => {
            expression_plus_minus_count(left) + expression_plus_minus_count(right)
        }
        Expr::Number(_) | Expr::Var(_) => 0,
    }
}

fn expand_plus_minus(equation: &Equation, limit: usize) -> Option<Vec<Equation>> {
    if plus_minus_count(equation) > limit {
        return None;
    }

    let left_branches = expand_expression(&equation.left);
    let right_branches = expand_expression(&equation.right);
    let mut equations = Vec::with_capacity(left_branches.len() * right_branches.len());
    for left in &left_branches {
        for right in &right_branches {
            equations.push(Equation {
                left: left.clone(),
                right: right.clone(),
            });
        }
    }
    Some(equations)
}

fn expand_expression(expr: &Expr) -> Vec<Expr> {
    match expr {
        Expr::PlusMinus(inner) => {
            let mut branches = Vec::new();
            for branch in expand_expression(inner) {
                branches.push(branch.clone());
                branches.push(Expr::Neg(Box::new(branch)));
            }
            branches
        }
        Expr::Neg(inner) => expand_expression(inner)
            .into_iter()
            .map(|branch| Expr::Neg(Box::new(branch)))
            .collect(),
        Expr::Binary { op, left, right } => {
            let left_branches = expand_expression(left);
            let right_branches = expand_expression(right);
            let mut branches = Vec::new();
            for left in &left_branches {
                for right in &right_branches {
                    branches.push(Expr::Binary {
                        op: *op,
                        left: Box::new(left.clone()),
                        right: Box::new(right.clone()),
                    });
                }
            }
            branches
        }
        Expr::Number(_) | Expr::Var(_) => vec![expr.clone()],
    }
}

fn expression_operands_are_single(expr: &Expr, singles: &BTreeMap<String, f64>) -> bool {
    match expr {
        Expr::PlusMinus(inner) => {
            matches!(linearize(inner, singles), LinearizeOutcome::Numeric(_))
                && expression_operands_are_single(inner, singles)
        }
        Expr::Neg(inner) => expression_operands_are_single(inner, singles),
        Expr::Binary { left, right, .. } => {
            expression_operands_are_single(left, singles)
                && expression_operands_are_single(right, singles)
        }
        Expr::Number(_) | Expr::Var(_) => true,
    }
}

fn direct_target(equation: &Equation) -> Option<&str> {
    if let Expr::Var(name) = &equation.left {
        return Some(name);
    }
    if let Expr::Var(name) = &equation.right {
        return Some(name);
    }
    None
}

fn branch_union(survivors: &[State], name: &str) -> Vec<f64> {
    let mut values = Vec::new();
    for branch in survivors {
        match branch.values.get(name) {
            Some(Value::Single(value)) => values.push(*value),
            Some(Value::Set(set)) => values.extend(set.iter().copied()),
            None => {}
        }
    }
    normalized_roots(values)
}

fn unknown_variables(equation: &Equation, values: &BTreeMap<String, Value>) -> BTreeSet<String> {
    let mut names = BTreeSet::new();
    collect_unknowns(&equation.left, values, &mut names);
    collect_unknowns(&equation.right, values, &mut names);
    names
}

fn collect_unknowns(expr: &Expr, values: &BTreeMap<String, Value>, names: &mut BTreeSet<String>) {
    match expr {
        Expr::Number(_) => {}
        Expr::Var(name) => {
            if !values.contains_key(name) {
                names.insert(name.clone());
            }
        }
        Expr::Neg(inner) | Expr::PlusMinus(inner) => collect_unknowns(inner, values, names),
        Expr::Binary { left, right, .. } => {
            collect_unknowns(left, values, names);
            collect_unknowns(right, values, names);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::format::Suggestion;

    fn input(texts: &[&str]) -> Vec<InputLine> {
        texts
            .iter()
            .enumerate()
            .map(|(index, text)| InputLine {
                id: format!("l{index}"),
                text: (*text).to_owned(),
            })
            .collect()
    }

    fn statuses(results: &[LineEvaluation]) -> Vec<LineStatus> {
        results.iter().map(|result| result.status).collect()
    }

    fn suggestion(display: &str, insert: &str) -> Option<Suggestion> {
        Some(Suggestion {
            display: display.to_owned(),
            insert: insert.to_owned(),
        })
    }

    fn assert_error(result: &LineEvaluation, message: &str) {
        assert_eq!(result.status, LineStatus::Error);
        assert_eq!(result.error.as_deref(), Some(message));
        assert_eq!(result.suggestion, None);
    }

    fn assert_skipped(result: &LineEvaluation) {
        assert_eq!(result.status, LineStatus::Skipped);
        assert_eq!(result.error, None);
        assert_eq!(result.suggestion, None);
    }

    #[test]
    fn evaluates_the_example_prefix() {
        let results = evaluate(&input(&["f = m × a", "f = 10", "m = 2", "a ="]));

        assert_eq!(
            statuses(&results),
            vec![
                LineStatus::Ok,
                LineStatus::Ok,
                LineStatus::Ok,
                LineStatus::Incomplete,
            ]
        );
        assert_eq!(results[0].error, None);
        assert_eq!(results[3].suggestion, suggestion("5", "5"));
    }

    #[test]
    fn dotted_multiplication_uses_known_values() {
        let results = evaluate(&input(&["x = 2", "y = 3", "a = x.y", "a ="]));

        assert_eq!(
            statuses(&results),
            vec![
                LineStatus::Ok,
                LineStatus::Ok,
                LineStatus::Ok,
                LineStatus::Incomplete,
            ]
        );
        assert_eq!(results[3].suggestion, suggestion("6", "6"));
    }

    #[test]
    fn multi_letter_names_are_not_implicit_products() {
        let results = evaluate(&input(&["xy = 5", "a = xy", "a ="]));

        assert_eq!(
            statuses(&results),
            vec![LineStatus::Ok, LineStatus::Ok, LineStatus::Incomplete]
        );
        assert_eq!(results[2].suggestion, suggestion("5", "5"));
    }

    #[test]
    fn formula_after_values_does_not_fill_an_earlier_assignment() {
        let results = evaluate(&input(&["a =", "f = 10", "m = 2", "f = m × a", "a ="]));

        assert_eq!(
            statuses(&results),
            vec![
                LineStatus::Incomplete,
                LineStatus::Ok,
                LineStatus::Ok,
                LineStatus::Ok,
                LineStatus::Incomplete,
            ]
        );
        assert_eq!(results[0].suggestion, None);
        assert_eq!(results[4].suggestion, suggestion("5", "5"));
    }

    #[test]
    fn empty_lines_are_ignored() {
        let results = evaluate(&input(&["", "   ", "a = 1"]));

        assert_eq!(
            statuses(&results),
            vec![LineStatus::Empty, LineStatus::Empty, LineStatus::Ok]
        );
    }

    #[test]
    fn incomplete_forms_are_not_errors() {
        let results = evaluate(&input(&["a =", "a = 2 +", "a", "a = ("]));

        assert_eq!(
            statuses(&results),
            vec![
                LineStatus::Incomplete,
                LineStatus::Incomplete,
                LineStatus::Incomplete,
                LineStatus::Incomplete,
            ]
        );
        assert!(results.iter().all(|result| result.suggestion.is_none()));
        assert!(results.iter().all(|result| result.error.is_none()));
    }

    #[test]
    fn invalid_syntax_stops_evaluation() {
        let results = evaluate(&input(&["a = 1", "a = 2 3", "", "a ="]));

        assert_eq!(results[0].status, LineStatus::Ok);
        assert_error(&results[1], "invalid");
        assert_skipped(&results[2]);
        assert_skipped(&results[3]);
    }

    #[test]
    fn false_numeric_equality_is_an_error() {
        let results = evaluate(&input(&["1 = 2", "a = 1"]));

        assert_error(&results[0], "false");
        assert_skipped(&results[1]);
    }

    #[test]
    fn division_by_zero_uses_the_exact_error() {
        let results = evaluate(&input(&["x = 1 / 0"]));

        assert_error(&results[0], "÷ 0");
    }

    #[test]
    fn direct_assignment_conflict_keeps_the_first_value() {
        let results = evaluate(&input(&["a = 5", "a = 6"]));

        assert_eq!(results[0].status, LineStatus::Ok);
        assert_error(&results[1], "a = 5");
    }

    #[test]
    fn a_matching_direct_assignment_is_ok() {
        let results = evaluate(&input(&["a = 5", "a = 2 + 3", "a ="]));

        assert_eq!(
            statuses(&results),
            vec![LineStatus::Ok, LineStatus::Ok, LineStatus::Incomplete,]
        );
        assert_eq!(results[2].suggestion, suggestion("5", "5"));
    }

    #[test]
    fn first_value_is_kept_across_constraints() {
        let results = evaluate(&input(&["a = 5", "a * 2 = 10", "a ="]));

        assert_eq!(
            statuses(&results),
            vec![LineStatus::Ok, LineStatus::Ok, LineStatus::Incomplete,]
        );
        assert_eq!(results[2].suggestion, suggestion("5", "5"));
    }

    #[test]
    fn solves_a_two_by_two_linear_system() {
        let results = evaluate(&input(&["x + y = 3", "x - y = 1", "x =", "y ="]));

        assert_eq!(
            statuses(&results),
            vec![
                LineStatus::Ok,
                LineStatus::Ok,
                LineStatus::Incomplete,
                LineStatus::Incomplete,
            ]
        );
        assert_eq!(results[2].suggestion, suggestion("2", "2"));
        assert_eq!(results[3].suggestion, suggestion("1", "1"));
    }

    #[test]
    fn pending_formula_is_rechecked_after_new_values() {
        let results = evaluate(&input(&["a = b^2", "b = 2", "a ="]));

        assert_eq!(
            statuses(&results),
            vec![LineStatus::Ok, LineStatus::Ok, LineStatus::Incomplete,]
        );
        assert_eq!(results[2].suggestion, suggestion("4", "4"));
    }

    #[test]
    fn multiple_constraints_can_determine_another_variable() {
        let results = evaluate(&input(&["x = 5", "x + y = 7", "y ="]));

        assert_eq!(
            statuses(&results),
            vec![LineStatus::Ok, LineStatus::Ok, LineStatus::Incomplete,]
        );
        assert_eq!(results[2].suggestion, suggestion("2", "2"));
    }

    #[test]
    fn unsupported_valid_lines_are_ok_and_silent() {
        let results = evaluate(&input(&["x^3 + x = 0", "x ="]));

        assert_eq!(
            statuses(&results),
            vec![LineStatus::Ok, LineStatus::Incomplete]
        );
        assert_eq!(results[0].error, None);
        assert_eq!(results[0].suggestion, None);
        assert_eq!(results[1].suggestion, None);
    }

    #[test]
    fn identity_is_ok() {
        let results = evaluate(&input(&["x - x = 0", "a = 1"]));

        assert_eq!(statuses(&results), vec![LineStatus::Ok, LineStatus::Ok]);
    }

    #[test]
    fn multiple_roots_create_a_symmetric_set() {
        let results = evaluate(&input(&["x^2 = 4", "x ="]));

        assert_eq!(
            statuses(&results),
            vec![LineStatus::Ok, LineStatus::Incomplete]
        );
        assert_eq!(results[0].error, None);
        assert_eq!(results[1].suggestion, suggestion("±2", "±2"));
    }

    #[test]
    fn non_finite_arithmetic_is_invalid() {
        let results = evaluate(&input(&["x = 10 ^ 309"]));

        assert_error(&results[0], "invalid");
    }

    #[test]
    fn pending_conflict_is_attributed_to_the_current_line() {
        let results = evaluate(&input(&["x^2 + y^2 = 0", "x = 1"]));

        assert_eq!(results[0].status, LineStatus::Ok);
        assert_eq!(results[0].error, None);
        assert_error(&results[1], "false");
    }

    #[test]
    fn fully_known_formula_conflict_names_the_known_value() {
        let results = evaluate(&input(&["f = 10", "m = 2", "a = 6", "f = m * a"]));

        assert_eq!(
            statuses(&results[..3]),
            vec![LineStatus::Ok, LineStatus::Ok, LineStatus::Ok]
        );
        assert_error(&results[3], "f = 10");
    }
}

#[cfg(test)]
mod sets {
    use super::*;
    use crate::format::Suggestion;

    fn input(texts: &[&str]) -> Vec<InputLine> {
        texts
            .iter()
            .enumerate()
            .map(|(index, text)| InputLine {
                id: format!("l{index}"),
                text: (*text).to_owned(),
            })
            .collect()
    }

    fn statuses(results: &[LineEvaluation]) -> Vec<LineStatus> {
        results.iter().map(|result| result.status).collect()
    }

    fn suggestion(display: &str, insert: &str) -> Option<Suggestion> {
        Some(Suggestion {
            display: display.to_owned(),
            insert: insert.to_owned(),
        })
    }

    fn assert_error(result: &LineEvaluation, message: &str) {
        assert_eq!(result.status, LineStatus::Error);
        assert_eq!(result.error.as_deref(), Some(message));
        assert_eq!(result.suggestion, None);
    }

    #[test]
    fn creates_a_symmetric_set_and_suggests_it() {
        let results = evaluate(&input(&["x^2 = 4", "x ="]));

        assert_eq!(
            statuses(&results),
            vec![LineStatus::Ok, LineStatus::Incomplete]
        );
        assert_eq!(results[1].suggestion, suggestion("±2", "±2"));
    }

    #[test]
    fn matching_assignment_narrows_the_set() {
        let results = evaluate(&input(&["x^2 = 4", "x = 2", "x ="]));

        assert_eq!(
            statuses(&results),
            vec![LineStatus::Ok, LineStatus::Ok, LineStatus::Incomplete,]
        );
        assert_eq!(results[2].suggestion, suggestion("2", "2"));
    }

    #[test]
    fn outside_assignment_conflicts_showing_the_set() {
        let results = evaluate(&input(&["x^2 = 4", "x = 3"]));

        assert_eq!(results[0].status, LineStatus::Ok);
        assert_error(&results[1], "x = ±2");
    }

    #[test]
    fn duplicate_roots_become_a_single_value() {
        let results = evaluate(&input(&["x^2 = 0", "x ="]));

        assert_eq!(
            statuses(&results),
            vec![LineStatus::Ok, LineStatus::Incomplete]
        );
        assert_eq!(results[1].suggestion, suggestion("0", "0"));
    }

    #[test]
    fn non_symmetric_set_inserts_the_largest() {
        let results = evaluate(&input(&["x^2 + x = 0", "x ="]));

        assert_eq!(
            statuses(&results),
            vec![LineStatus::Ok, LineStatus::Incomplete]
        );
        assert_eq!(results[1].suggestion, suggestion("0, -1", "0"));
    }

    #[test]
    fn a_second_set_waits_for_the_slot() {
        let results = evaluate(&input(&[
            "x^2 = 4", "y^2 = 9", "x =", "y =", "x = 2", "y =",
        ]));

        assert_eq!(
            statuses(&results),
            vec![
                LineStatus::Ok,
                LineStatus::Ok,
                LineStatus::Incomplete,
                LineStatus::Incomplete,
                LineStatus::Ok,
                LineStatus::Incomplete,
            ]
        );
        assert_eq!(results[2].suggestion, suggestion("±2", "±2"));
        assert_eq!(results[3].suggestion, None);
        assert_eq!(results[5].suggestion, suggestion("±3", "±3"));
    }

    #[test]
    fn a_set_does_not_propagate_through_a_formula() {
        let results = evaluate(&input(&["x^2 = 4", "y = x + 1", "y ="]));

        assert_eq!(
            statuses(&results),
            vec![LineStatus::Ok, LineStatus::Ok, LineStatus::Incomplete,]
        );
        assert_eq!(results[2].suggestion, None);
    }

    #[test]
    fn a_pending_formula_narrows_after_the_set_value() {
        let results = evaluate(&input(&["x^2 = 4", "y = x + 1", "y =", "x = 2", "y ="]));

        assert_eq!(
            statuses(&results),
            vec![
                LineStatus::Ok,
                LineStatus::Ok,
                LineStatus::Incomplete,
                LineStatus::Ok,
                LineStatus::Incomplete,
            ]
        );
        assert_eq!(results[2].suggestion, None);
        assert_eq!(results[4].suggestion, suggestion("3", "3"));
    }

    #[test]
    fn a_linear_relation_narrows_a_set() {
        let results = evaluate(&input(&["x^2 = 4", "x + 1 = 3", "x ="]));

        assert_eq!(
            statuses(&results),
            vec![LineStatus::Ok, LineStatus::Ok, LineStatus::Incomplete,]
        );
        assert_eq!(results[2].suggestion, suggestion("2", "2"));
    }

    #[test]
    fn a_linear_relation_before_the_set_narrows_it() {
        let results = evaluate(&input(&["x + y = 3", "x^2 = 4", "y = 1", "x ="]));

        assert_eq!(
            statuses(&results),
            vec![
                LineStatus::Ok,
                LineStatus::Ok,
                LineStatus::Ok,
                LineStatus::Incomplete,
            ]
        );
        assert_eq!(results[3].suggestion, suggestion("2", "2"));
    }

    #[test]
    fn a_linear_relation_before_the_set_can_conflict() {
        let results = evaluate(&input(&["x + y = 3", "x^2 = 4", "y = 4"]));

        assert_eq!(results[0].status, LineStatus::Ok);
        assert_eq!(results[1].status, LineStatus::Ok);
        assert_error(&results[2], "x = ±2");
    }

    #[test]
    fn a_non_linear_equation_involving_a_set_stays_pending() {
        let results = evaluate(&input(&["x^2 = 4", "x^3 = 8", "x ="]));

        assert_eq!(
            statuses(&results),
            vec![LineStatus::Ok, LineStatus::Ok, LineStatus::Incomplete,]
        );
        assert_eq!(results[1].error, None);
        assert_eq!(results[2].suggestion, suggestion("±2", "±2"));
    }

    #[test]
    fn a_fixed_value_never_becomes_a_set() {
        let results = evaluate(&input(&["x = 2", "x^2 = 4", "x ="]));

        assert_eq!(
            statuses(&results),
            vec![LineStatus::Ok, LineStatus::Ok, LineStatus::Incomplete,]
        );
        assert_eq!(results[2].suggestion, suggestion("2", "2"));
    }

    #[test]
    fn a_non_symmetric_set_conflict_uses_set_notation() {
        let results = evaluate(&input(&["x^2 + x = 0", "x = 2"]));

        assert_error(&results[1], "x = 0, -1");
    }
}

#[cfg(test)]
mod plus_minus {
    use super::*;
    use crate::format::Suggestion;

    fn input(texts: &[&str]) -> Vec<InputLine> {
        texts
            .iter()
            .enumerate()
            .map(|(index, text)| InputLine {
                id: format!("l{index}"),
                text: (*text).to_owned(),
            })
            .collect()
    }

    fn statuses(results: &[LineEvaluation]) -> Vec<LineStatus> {
        results.iter().map(|result| result.status).collect()
    }

    fn suggestion(display: &str, insert: &str) -> Option<Suggestion> {
        Some(Suggestion {
            display: display.to_owned(),
            insert: insert.to_owned(),
        })
    }

    fn assert_error(result: &LineEvaluation, message: &str) {
        assert_eq!(result.status, LineStatus::Error);
        assert_eq!(result.error.as_deref(), Some(message));
        assert_eq!(result.suggestion, None);
    }

    #[test]
    fn a_plus_minus_assignment_creates_a_symmetric_set() {
        let results = evaluate(&input(&["x = ±2", "x ="]));

        assert_eq!(
            statuses(&results),
            vec![LineStatus::Ok, LineStatus::Incomplete]
        );
        assert_eq!(results[1].suggestion, suggestion("±2", "±2"));
    }

    #[test]
    fn a_nested_plus_minus_formula_collects_a_set() {
        let results = evaluate(&input(&["a + (2 + ±3) = 10", "a ="]));

        assert_eq!(
            statuses(&results),
            vec![LineStatus::Ok, LineStatus::Incomplete]
        );
        assert_eq!(results[1].suggestion, suggestion("11, 5", "11"));
    }

    #[test]
    fn infix_plus_minus_is_invalid() {
        let results = evaluate(&input(&["a = 2 ± 3"]));

        assert_error(&results[0], "invalid");
    }

    #[test]
    fn plus_minus_zero_becomes_a_single_value() {
        let results = evaluate(&input(&["x = ±0", "x ="]));

        assert_eq!(
            statuses(&results),
            vec![LineStatus::Ok, LineStatus::Incomplete]
        );
        assert_eq!(results[1].suggestion, suggestion("0", "0"));
    }

    #[test]
    fn a_known_single_stays_when_a_branch_matches() {
        let results = evaluate(&input(&["x = 2", "x = ±2", "x ="]));

        assert_eq!(
            statuses(&results),
            vec![LineStatus::Ok, LineStatus::Ok, LineStatus::Incomplete,]
        );
        assert_eq!(results[2].suggestion, suggestion("2", "2"));
    }

    #[test]
    fn a_known_single_conflicts_when_no_branch_matches() {
        let results = evaluate(&input(&["x = 3", "x = ±2"]));

        assert_eq!(results[0].status, LineStatus::Ok);
        assert_error(&results[1], "x = 3");
    }

    #[test]
    fn a_set_containing_both_branches_is_kept() {
        let results = evaluate(&input(&["x^2 = 4", "x = ±2", "x ="]));

        assert_eq!(
            statuses(&results),
            vec![LineStatus::Ok, LineStatus::Ok, LineStatus::Incomplete,]
        );
        assert_eq!(results[2].suggestion, suggestion("±2", "±2"));
    }

    #[test]
    fn a_set_containing_one_branch_narrows() {
        let results = evaluate(&input(&["x^2 - 5 * x + 6 = 0", "x = ±2", "x ="]));

        assert_eq!(
            statuses(&results),
            vec![LineStatus::Ok, LineStatus::Ok, LineStatus::Incomplete,]
        );
        assert_eq!(results[2].suggestion, suggestion("2", "2"));
    }

    #[test]
    fn more_than_two_plus_minus_nodes_are_silent() {
        let results = evaluate(&input(&["x = ±1 + ±2 + ±3", "x ="]));

        assert_eq!(
            statuses(&results),
            vec![LineStatus::Ok, LineStatus::Incomplete]
        );
        assert_eq!(results[0].error, None);
        assert_eq!(results[1].suggestion, None);
    }

    #[test]
    fn two_plus_minus_nodes_make_four_branches() {
        let results = evaluate(&input(&["a = ±1 + ±2", "a ="]));

        assert_eq!(
            statuses(&results),
            vec![LineStatus::Ok, LineStatus::Incomplete]
        );
        assert_eq!(results[1].suggestion, suggestion("3, 1, -1, -3", "3"));
    }

    #[test]
    fn a_set_operand_stays_pending() {
        let results = evaluate(&input(&["x^2 = 4", "y = ±x", "y ="]));

        assert_eq!(
            statuses(&results),
            vec![LineStatus::Ok, LineStatus::Ok, LineStatus::Incomplete,]
        );
        assert_eq!(results[1].error, None);
        assert_eq!(results[2].suggestion, None);
    }

    #[test]
    fn a_pending_set_operand_branches_after_narrowing() {
        let results = evaluate(&input(&["x^2 = 4", "y = ±x", "x = 2", "y ="]));

        assert_eq!(
            statuses(&results),
            vec![
                LineStatus::Ok,
                LineStatus::Ok,
                LineStatus::Ok,
                LineStatus::Incomplete,
            ]
        );
        assert_eq!(results[3].suggestion, suggestion("±2", "±2"));
    }

    #[test]
    fn a_formula_branches_with_a_known_multiplier() {
        let results = evaluate(&input(&["m = 3", "f = ±2 * m", "f ="]));

        assert_eq!(
            statuses(&results),
            vec![LineStatus::Ok, LineStatus::Ok, LineStatus::Incomplete,]
        );
        assert_eq!(results[2].suggestion, suggestion("±6", "±6"));
    }

    #[test]
    fn a_blocked_set_is_retried_when_the_slot_frees() {
        let results = evaluate(&input(&["x^2 = 4", "y = ±3", "y =", "x = 2", "y ="]));

        assert_eq!(
            statuses(&results),
            vec![
                LineStatus::Ok,
                LineStatus::Ok,
                LineStatus::Incomplete,
                LineStatus::Ok,
                LineStatus::Incomplete,
            ]
        );
        assert_eq!(results[2].suggestion, None);
        assert_eq!(results[4].suggestion, suggestion("±3", "±3"));
    }

    #[test]
    fn branches_that_all_divide_by_zero_show_division_by_zero() {
        let results = evaluate(&input(&["x = ±2 / 0"]));

        assert_error(&results[0], "÷ 0");
    }

    #[test]
    fn branches_that_all_go_non_finite_are_invalid() {
        let results = evaluate(&input(&["x = ±2 * 10^309"]));

        assert_error(&results[0], "invalid");
    }

    #[test]
    fn a_false_disjunction_without_a_target_is_false() {
        let results = evaluate(&input(&["±1 = ±2"]));

        assert_error(&results[0], "false");
    }
}
