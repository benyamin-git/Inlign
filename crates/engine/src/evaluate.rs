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
                Ok(ParseOutcome::Equation(equation)) => match state.apply_equation(&equation) {
                    ApplyOutcome::Applied => {
                        state.record(&equation, true);
                        state.finish_line()
                    }
                    ApplyOutcome::Pending => {
                        state.record(&equation, false);
                        state.add_pending(&equation);
                        state.finish_line()
                    }
                    ApplyOutcome::Error(error) => (LineStatus::Error, None, Some(error)),
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

struct Constraint {
    equation: Equation,
    applied: bool,
}

#[derive(Default)]
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

    fn finish_line(&mut self) -> (LineStatus, Option<Suggestion>, Option<String>) {
        match self.recheck_pending() {
            Ok(()) => (LineStatus::Ok, None, None),
            Err(error) => (LineStatus::Error, None, Some(error)),
        }
    }

    fn recheck_pending(&mut self) -> Result<(), String> {
        for _ in 0..64 {
            let before = self.values.clone();
            let pending = std::mem::take(&mut self.pending);
            let mut remaining = Vec::with_capacity(pending.len());

            for equation in pending {
                match self.apply_equation(&equation) {
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
