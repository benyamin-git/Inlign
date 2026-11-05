//! Incremental linear algebra used by the prefix evaluator.

use std::collections::BTreeMap;

use crate::ast::{BinOp, Expr};
use crate::format::approx_eq;

/// A linear form `sum(coeffs[v] * v) + constant`.
#[derive(Debug, Clone, PartialEq)]
pub struct LinearForm {
    pub coeffs: BTreeMap<String, f64>,
    pub constant: f64,
}

/// Whether a row was independent or contradicted the current system.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AddOutcome {
    Consistent,
    Inconsistent,
}

/// An incrementally maintained reduced row-echelon system.
#[derive(Debug, Default, Clone)]
pub struct LinearSystem {
    vars: Vec<String>,
    index: BTreeMap<String, usize>,
    rows: Vec<Row>,
    pivots: Vec<usize>,
}

#[derive(Debug, Clone)]
struct Row {
    coeffs: Vec<f64>,
    constant: f64,
}

impl LinearSystem {
    /// Creates an empty system.
    pub fn new() -> Self {
        Self::default()
    }

    /// Adds `sum(coeffs[v] * v) + constant = 0`.
    pub fn add(&mut self, form: LinearForm) -> AddOutcome {
        let mut new_vars: Vec<String> = Vec::new();
        for name in form.coeffs.keys() {
            if !self.index.contains_key(name) {
                new_vars.push(name.clone());
            }
        }

        let mut working = vec![0.0; self.vars.len() + new_vars.len()];
        for (name, coeff) in &form.coeffs {
            let index = self.index.get(name).copied().or_else(|| {
                new_vars
                    .iter()
                    .position(|new| new == name)
                    .map(|offset| self.vars.len() + offset)
            });
            if let Some(index) = index {
                working[index] = *coeff;
            }
        }

        let mut constant = form.constant;
        for (row, pivot) in self.rows.iter().zip(&self.pivots) {
            let factor = working[*pivot];
            if factor != 0.0 {
                for (coeff, row_coeff) in working.iter_mut().zip(&row.coeffs) {
                    *coeff -= factor * row_coeff;
                }
                working[*pivot] = 0.0;
                constant -= factor * row.constant;
            }
        }

        let row_max = working
            .iter()
            .fold(1.0f64, |max, value| max.max(value.abs()));
        let zero = 1e-12 * row_max;
        if working.iter().all(|value| value.abs() <= zero) {
            return if constant.abs() <= zero {
                AddOutcome::Consistent
            } else {
                AddOutcome::Inconsistent
            };
        }

        for name in &new_vars {
            let index = self.vars.len();
            self.vars.push(name.clone());
            self.index.insert(name.clone(), index);
            for row in &mut self.rows {
                row.coeffs.push(0.0);
            }
        }

        let Some(pivot) = working.iter().position(|value| value.abs() > zero) else {
            return AddOutcome::Consistent;
        };
        let divisor = working[pivot];
        for value in &mut working {
            *value /= divisor;
        }
        let constant = constant / divisor;
        working[pivot] = 1.0;

        for (row, _) in self.rows.iter_mut().zip(&self.pivots) {
            let factor = row.coeffs[pivot];
            if factor != 0.0 {
                for (coeff, new_coeff) in row.coeffs.iter_mut().zip(&working) {
                    *coeff -= factor * new_coeff;
                }
                row.constant -= factor * constant;
                row.coeffs[pivot] = 0.0;
            }
        }

        self.rows.push(Row {
            coeffs: working,
            constant,
        });
        self.pivots.push(pivot);
        AddOutcome::Consistent
    }

    /// Returns only uniquely determined singleton values.
    pub fn values(&self) -> BTreeMap<String, f64> {
        let mut values = BTreeMap::new();
        for (row, pivot) in self.rows.iter().zip(&self.pivots) {
            let row_max = row
                .coeffs
                .iter()
                .fold(1.0f64, |max, value| max.max(value.abs()));
            let zero = 1e-12 * row_max;
            let has_free = row
                .coeffs
                .iter()
                .enumerate()
                .any(|(index, coeff)| index != *pivot && coeff.abs() > zero);
            if !has_free {
                values.insert(self.vars[*pivot].clone(), -row.constant);
            }
        }
        values
    }
}

/// The result of linearizing one expression against known values.
#[derive(Debug, Clone, PartialEq)]
pub enum LinearizeOutcome {
    Linear(LinearForm),
    Numeric(f64),
    Nonlinear,
    DivisionByZero,
    NonFinite,
}

/// Linearizes an expression, substituting known singleton values.
pub fn linearize(expr: &Expr, values: &BTreeMap<String, f64>) -> LinearizeOutcome {
    match expr {
        Expr::Number(value) => numeric(*value),
        Expr::Var(name) => match values.get(name) {
            Some(value) => numeric(*value),
            None => LinearizeOutcome::Linear(LinearForm {
                coeffs: BTreeMap::from([(name.clone(), 1.0)]),
                constant: 0.0,
            }),
        },
        Expr::Neg(inner) => negate(linearize(inner, values)),
        Expr::PlusMinus(_) => LinearizeOutcome::Nonlinear,
        Expr::Binary { op, left, right } => {
            let left = linearize(left, values);
            let right = linearize(right, values);
            match op {
                BinOp::Add => add(left, right),
                BinOp::Sub => add(left, negate(right)),
                BinOp::Mul => multiply(left, right),
                BinOp::Div => divide(left, right),
                BinOp::Pow => power(left, right),
            }
        }
    }
}

fn numeric(value: f64) -> LinearizeOutcome {
    if value.is_finite() {
        LinearizeOutcome::Numeric(value)
    } else {
        LinearizeOutcome::NonFinite
    }
}

fn negate(outcome: LinearizeOutcome) -> LinearizeOutcome {
    match outcome {
        LinearizeOutcome::Numeric(value) => numeric(-value),
        LinearizeOutcome::Linear(form) => scale_form(form, -1.0),
        other => other,
    }
}

fn add(left: LinearizeOutcome, right: LinearizeOutcome) -> LinearizeOutcome {
    if matches!(&left, LinearizeOutcome::DivisionByZero)
        || matches!(&right, LinearizeOutcome::DivisionByZero)
    {
        return LinearizeOutcome::DivisionByZero;
    }
    if matches!(&left, LinearizeOutcome::NonFinite) || matches!(&right, LinearizeOutcome::NonFinite)
    {
        return LinearizeOutcome::NonFinite;
    }
    if matches!(&left, LinearizeOutcome::Nonlinear) || matches!(&right, LinearizeOutcome::Nonlinear)
    {
        return LinearizeOutcome::Nonlinear;
    }
    match (left, right) {
        (LinearizeOutcome::Numeric(a), LinearizeOutcome::Numeric(b)) => numeric(a + b),
        (LinearizeOutcome::Numeric(value), LinearizeOutcome::Linear(form)) => {
            add_constant(form, value)
        }
        (LinearizeOutcome::Linear(form), LinearizeOutcome::Numeric(value)) => {
            add_constant(form, value)
        }
        (LinearizeOutcome::Linear(a), LinearizeOutcome::Linear(b)) => add_forms(a, b),
        _ => LinearizeOutcome::Nonlinear,
    }
}

fn add_constant(mut form: LinearForm, value: f64) -> LinearizeOutcome {
    form.constant += value;
    normalize_form(form)
}

fn add_forms(mut left: LinearForm, right: LinearForm) -> LinearizeOutcome {
    for (name, coeff) in right.coeffs {
        *left.coeffs.entry(name).or_insert(0.0) += coeff;
    }
    left.constant += right.constant;
    normalize_form(left)
}

fn multiply(left: LinearizeOutcome, right: LinearizeOutcome) -> LinearizeOutcome {
    if matches!(&left, LinearizeOutcome::DivisionByZero)
        || matches!(&right, LinearizeOutcome::DivisionByZero)
    {
        return LinearizeOutcome::DivisionByZero;
    }
    if matches!(&left, LinearizeOutcome::NonFinite) || matches!(&right, LinearizeOutcome::NonFinite)
    {
        return LinearizeOutcome::NonFinite;
    }
    if matches!(&left, LinearizeOutcome::Nonlinear) || matches!(&right, LinearizeOutcome::Nonlinear)
    {
        return LinearizeOutcome::Nonlinear;
    }
    match (left, right) {
        (LinearizeOutcome::Numeric(a), LinearizeOutcome::Numeric(b)) => numeric(a * b),
        (LinearizeOutcome::Numeric(value), LinearizeOutcome::Linear(form)) => {
            scale_form(form, value)
        }
        (LinearizeOutcome::Linear(form), LinearizeOutcome::Numeric(value)) => {
            scale_form(form, value)
        }
        _ => LinearizeOutcome::Nonlinear,
    }
}

fn divide(left: LinearizeOutcome, right: LinearizeOutcome) -> LinearizeOutcome {
    if matches!(&left, LinearizeOutcome::DivisionByZero)
        || matches!(&right, LinearizeOutcome::DivisionByZero)
    {
        return LinearizeOutcome::DivisionByZero;
    }
    if matches!(&left, LinearizeOutcome::NonFinite) || matches!(&right, LinearizeOutcome::NonFinite)
    {
        return LinearizeOutcome::NonFinite;
    }
    match right {
        LinearizeOutcome::Numeric(denominator) => {
            if approx_eq(denominator, 0.0) {
                return LinearizeOutcome::DivisionByZero;
            }
            match left {
                LinearizeOutcome::Numeric(numerator) => numeric(numerator / denominator),
                LinearizeOutcome::Linear(form) => scale_form(form, 1.0 / denominator),
                _ => LinearizeOutcome::Nonlinear,
            }
        }
        _ => LinearizeOutcome::Nonlinear,
    }
}

fn power(base: LinearizeOutcome, exponent: LinearizeOutcome) -> LinearizeOutcome {
    if matches!(&base, LinearizeOutcome::DivisionByZero)
        || matches!(&exponent, LinearizeOutcome::DivisionByZero)
    {
        return LinearizeOutcome::DivisionByZero;
    }
    if matches!(&base, LinearizeOutcome::NonFinite)
        || matches!(&exponent, LinearizeOutcome::NonFinite)
    {
        return LinearizeOutcome::NonFinite;
    }
    match (base, exponent) {
        (LinearizeOutcome::Numeric(base), LinearizeOutcome::Numeric(exponent)) => {
            if exponent == 1.0 {
                numeric(base)
            } else {
                numeric(base.powf(exponent))
            }
        }
        (LinearizeOutcome::Linear(form), LinearizeOutcome::Numeric(1.0)) => {
            LinearizeOutcome::Linear(form)
        }
        _ => LinearizeOutcome::Nonlinear,
    }
}

fn scale_form(mut form: LinearForm, factor: f64) -> LinearizeOutcome {
    if !factor.is_finite() {
        return LinearizeOutcome::NonFinite;
    }
    if factor == 0.0 {
        return LinearizeOutcome::Numeric(0.0);
    }
    for coeff in form.coeffs.values_mut() {
        *coeff *= factor;
    }
    form.constant *= factor;
    normalize_form(form)
}

fn normalize_form(mut form: LinearForm) -> LinearizeOutcome {
    form.coeffs.retain(|_, coeff| *coeff != 0.0);
    if !form.constant.is_finite() || form.coeffs.values().any(|coeff| !coeff.is_finite()) {
        return LinearizeOutcome::NonFinite;
    }
    if form.coeffs.is_empty() {
        LinearizeOutcome::Numeric(form.constant)
    } else {
        LinearizeOutcome::Linear(form)
    }
}

/// The result of solving `expr = 0` for one variable.
#[derive(Debug, Clone, PartialEq)]
pub enum UnivariateOutcome {
    Roots(Vec<f64>),
    NoRealRoots,
    Identity,
    Unsolved,
    DivisionByZero,
    NonFinite,
}

/// Solves `expr = 0` for `var`; known singleton values are substituted.
pub fn solve_univariate(
    expr: &Expr,
    var: &str,
    values: &BTreeMap<String, f64>,
) -> UnivariateOutcome {
    match to_poly(expr, var, values) {
        PolyOutcome::Poly(poly) => solve_poly(poly),
        PolyOutcome::DivisionByZero => UnivariateOutcome::DivisionByZero,
        PolyOutcome::NonFinite => UnivariateOutcome::NonFinite,
        PolyOutcome::NotPolynomial => match to_rational(expr, var, values) {
            RationalOutcome::Rational(form) => solve_rational(form),
            RationalOutcome::DivisionByZero => UnivariateOutcome::DivisionByZero,
            RationalOutcome::NonFinite => UnivariateOutcome::NonFinite,
            RationalOutcome::NotRational => UnivariateOutcome::Unsolved,
        },
    }
}

#[derive(Debug, Clone, PartialEq)]
struct Poly {
    coeffs: Vec<f64>,
}

impl Poly {
    fn constant(value: f64) -> Self {
        Self {
            coeffs: vec![value],
        }
    }

    fn one() -> Self {
        Self::constant(1.0)
    }

    fn zero() -> Self {
        Self::constant(0.0)
    }

    fn degree(&self) -> usize {
        let mut degree = self.coeffs.len().saturating_sub(1);
        while degree > 0 && approx_eq(self.coeffs[degree], 0.0) {
            degree -= 1;
        }
        degree
    }

    fn is_zero(&self) -> bool {
        self.coeffs.iter().all(|coeff| approx_eq(*coeff, 0.0))
    }

    fn trimmed(&self) -> Self {
        let degree = self.degree();
        Self {
            coeffs: self.coeffs[..=degree].to_vec(),
        }
    }

    fn add(&self, other: &Self) -> Self {
        let len = self.coeffs.len().max(other.coeffs.len());
        let mut coeffs = vec![0.0; len];
        for (index, coeff) in self.coeffs.iter().enumerate() {
            coeffs[index] += coeff;
        }
        for (index, coeff) in other.coeffs.iter().enumerate() {
            coeffs[index] += coeff;
        }
        Self { coeffs }.trimmed()
    }

    fn sub(&self, other: &Self) -> Self {
        let len = self.coeffs.len().max(other.coeffs.len());
        let mut coeffs = vec![0.0; len];
        for (index, coeff) in self.coeffs.iter().enumerate() {
            coeffs[index] += coeff;
        }
        for (index, coeff) in other.coeffs.iter().enumerate() {
            coeffs[index] -= coeff;
        }
        Self { coeffs }.trimmed()
    }

    fn mul(&self, other: &Self) -> Self {
        if self.is_zero() || other.is_zero() {
            return Self::zero();
        }
        let mut coeffs = vec![0.0; self.coeffs.len() + other.coeffs.len() - 1];
        for (left_index, left) in self.coeffs.iter().enumerate() {
            for (right_index, right) in other.coeffs.iter().enumerate() {
                coeffs[left_index + right_index] += left * right;
            }
        }
        Self { coeffs }.trimmed()
    }

    fn scale(&self, factor: f64) -> Self {
        Self {
            coeffs: self.coeffs.iter().map(|coeff| coeff * factor).collect(),
        }
        .trimmed()
    }

    fn pow(&self, exponent: u32, max_degree: usize) -> Option<Self> {
        let mut result = Self::one();
        for _ in 0..exponent {
            result = result.mul(self);
            if result.degree() > max_degree {
                return None;
            }
        }
        Some(result)
    }

    fn eval(&self, x: f64) -> f64 {
        self.coeffs
            .iter()
            .rev()
            .fold(0.0, |accumulator, coeff| accumulator * x + coeff)
    }
}

#[derive(Debug, Clone, PartialEq)]
enum PolyOutcome {
    Poly(Poly),
    NotPolynomial,
    DivisionByZero,
    NonFinite,
}

fn ensure_finite(poly: Poly) -> PolyOutcome {
    if poly.coeffs.iter().all(|coeff| coeff.is_finite()) {
        PolyOutcome::Poly(poly)
    } else {
        PolyOutcome::NonFinite
    }
}

#[derive(Debug, Clone, PartialEq)]
struct RationalForm {
    numerator: Poly,
    denominator: Poly,
}

#[derive(Debug, Clone, PartialEq)]
enum RationalOutcome {
    Rational(RationalForm),
    NotRational,
    DivisionByZero,
    NonFinite,
}

fn rational_constant(value: f64) -> RationalOutcome {
    if !value.is_finite() {
        return RationalOutcome::NonFinite;
    }
    RationalOutcome::Rational(RationalForm {
        numerator: Poly::constant(value),
        denominator: Poly::one(),
    })
}

fn cap_rational(numerator: Poly, denominator: Poly) -> RationalOutcome {
    if denominator.is_zero() {
        return RationalOutcome::DivisionByZero;
    }
    if !numerator.coeffs.iter().all(|coeff| coeff.is_finite())
        || !denominator.coeffs.iter().all(|coeff| coeff.is_finite())
    {
        return RationalOutcome::NonFinite;
    }
    if numerator.degree() > 2 || denominator.degree() > 1 {
        return RationalOutcome::NotRational;
    }
    RationalOutcome::Rational(RationalForm {
        numerator,
        denominator,
    })
}

fn rational_hard(left: &RationalOutcome, right: &RationalOutcome) -> Option<RationalOutcome> {
    if matches!(left, RationalOutcome::DivisionByZero)
        || matches!(right, RationalOutcome::DivisionByZero)
    {
        return Some(RationalOutcome::DivisionByZero);
    }
    if matches!(left, RationalOutcome::NonFinite) || matches!(right, RationalOutcome::NonFinite) {
        return Some(RationalOutcome::NonFinite);
    }
    if matches!(left, RationalOutcome::NotRational) || matches!(right, RationalOutcome::NotRational)
    {
        return Some(RationalOutcome::NotRational);
    }
    None
}

fn to_rational(expr: &Expr, var: &str, values: &BTreeMap<String, f64>) -> RationalOutcome {
    match expr {
        Expr::Number(value) => rational_constant(*value),
        Expr::Var(name) => {
            if name == var {
                RationalOutcome::Rational(RationalForm {
                    numerator: Poly {
                        coeffs: vec![0.0, 1.0],
                    },
                    denominator: Poly::one(),
                })
            } else if let Some(value) = values.get(name) {
                rational_constant(*value)
            } else {
                RationalOutcome::NotRational
            }
        }
        Expr::Neg(inner) => match to_rational(inner, var, values) {
            RationalOutcome::Rational(form) => {
                cap_rational(form.numerator.scale(-1.0), form.denominator)
            }
            other => other,
        },
        Expr::PlusMinus(_) => RationalOutcome::NotRational,
        Expr::Binary { op, left, right } => match op {
            BinOp::Add | BinOp::Sub => {
                let left = to_rational(left, var, values);
                let right = to_rational(right, var, values);
                if let Some(hard) = rational_hard(&left, &right) {
                    return hard;
                }
                let RationalOutcome::Rational(left) = left else {
                    return RationalOutcome::NotRational;
                };
                let RationalOutcome::Rational(right) = right else {
                    return RationalOutcome::NotRational;
                };
                let left_term = left.numerator.mul(&right.denominator);
                let right_term = right.numerator.mul(&left.denominator);
                let numerator = if *op == BinOp::Sub {
                    left_term.sub(&right_term)
                } else {
                    left_term.add(&right_term)
                };
                cap_rational(numerator, left.denominator.mul(&right.denominator))
            }
            BinOp::Mul => {
                let left = to_rational(left, var, values);
                let right = to_rational(right, var, values);
                if let Some(hard) = rational_hard(&left, &right) {
                    return hard;
                }
                let RationalOutcome::Rational(left) = left else {
                    return RationalOutcome::NotRational;
                };
                let RationalOutcome::Rational(right) = right else {
                    return RationalOutcome::NotRational;
                };
                cap_rational(
                    left.numerator.mul(&right.numerator),
                    left.denominator.mul(&right.denominator),
                )
            }
            BinOp::Div => {
                let left = to_rational(left, var, values);
                let right = to_rational(right, var, values);
                if matches!(&left, RationalOutcome::DivisionByZero)
                    || matches!(&right, RationalOutcome::DivisionByZero)
                {
                    return RationalOutcome::DivisionByZero;
                }
                if matches!(&left, RationalOutcome::NonFinite)
                    || matches!(&right, RationalOutcome::NonFinite)
                {
                    return RationalOutcome::NonFinite;
                }
                let RationalOutcome::Rational(right) = right else {
                    return RationalOutcome::NotRational;
                };
                if right.numerator.is_zero() {
                    return RationalOutcome::DivisionByZero;
                }
                let RationalOutcome::Rational(left) = left else {
                    return RationalOutcome::NotRational;
                };
                cap_rational(
                    left.numerator.mul(&right.denominator),
                    left.denominator.mul(&right.numerator),
                )
            }
            BinOp::Pow => {
                let base = match to_rational(left, var, values) {
                    RationalOutcome::Rational(base) => base,
                    other => return other,
                };
                let exponent = match rational_exponent(right, values) {
                    Ok(exponent) => exponent,
                    Err(outcome) => return outcome,
                };
                if base.numerator.degree() == 0 && base.denominator.degree() == 0 {
                    let value = base.numerator.coeffs[0] / base.denominator.coeffs[0];
                    let powered = value.powf(exponent);
                    return if powered.is_finite() {
                        RationalOutcome::Rational(RationalForm {
                            numerator: Poly::constant(powered),
                            denominator: Poly::one(),
                        })
                    } else {
                        RationalOutcome::NonFinite
                    };
                }
                if exponent.fract() != 0.0 || exponent.abs() > 64.0 {
                    return RationalOutcome::NotRational;
                }
                let power = exponent as i64;
                let (numerator_base, denominator_base) = if power >= 0 {
                    (base.numerator, base.denominator)
                } else {
                    if base.numerator.is_zero() {
                        return RationalOutcome::DivisionByZero;
                    }
                    (base.denominator, base.numerator)
                };
                let magnitude = power.unsigned_abs() as u32;
                let Some(numerator) = numerator_base.pow(magnitude, 64) else {
                    return RationalOutcome::NotRational;
                };
                let Some(denominator) = denominator_base.pow(magnitude, 64) else {
                    return RationalOutcome::NotRational;
                };
                cap_rational(numerator, denominator)
            }
        },
    }
}

fn rational_exponent(expr: &Expr, values: &BTreeMap<String, f64>) -> Result<f64, RationalOutcome> {
    match linearize(expr, values) {
        LinearizeOutcome::Numeric(value) => Ok(value),
        LinearizeOutcome::DivisionByZero => Err(RationalOutcome::DivisionByZero),
        LinearizeOutcome::NonFinite => Err(RationalOutcome::NonFinite),
        LinearizeOutcome::Linear(_) | LinearizeOutcome::Nonlinear => {
            Err(RationalOutcome::NotRational)
        }
    }
}

fn solve_rational(form: RationalForm) -> UnivariateOutcome {
    let RationalForm {
        numerator,
        denominator,
    } = form;
    if denominator.is_zero() {
        return UnivariateOutcome::DivisionByZero;
    }
    if numerator.is_zero() {
        return UnivariateOutcome::Identity;
    }
    match solve_poly(numerator) {
        UnivariateOutcome::Roots(roots) => {
            let roots: Vec<f64> = roots
                .into_iter()
                .filter(|root| {
                    let value = denominator.eval(*root);
                    value.is_finite() && !approx_eq(value, 0.0)
                })
                .collect();
            if roots.is_empty() {
                UnivariateOutcome::NoRealRoots
            } else {
                UnivariateOutcome::Roots(roots)
            }
        }
        other => other,
    }
}

fn to_poly(expr: &Expr, var: &str, values: &BTreeMap<String, f64>) -> PolyOutcome {
    match expr {
        Expr::Number(value) => {
            if value.is_finite() {
                PolyOutcome::Poly(Poly::constant(*value))
            } else {
                PolyOutcome::NonFinite
            }
        }
        Expr::Var(name) => {
            if name == var {
                PolyOutcome::Poly(Poly {
                    coeffs: vec![0.0, 1.0],
                })
            } else if let Some(value) = values.get(name) {
                if value.is_finite() {
                    PolyOutcome::Poly(Poly::constant(*value))
                } else {
                    PolyOutcome::NonFinite
                }
            } else {
                PolyOutcome::NotPolynomial
            }
        }
        Expr::Neg(inner) => match to_poly(inner, var, values) {
            PolyOutcome::Poly(poly) => ensure_finite(poly.scale(-1.0)),
            other => other,
        },
        Expr::PlusMinus(_) => PolyOutcome::NotPolynomial,
        Expr::Binary { op, left, right } => match op {
            BinOp::Add | BinOp::Sub | BinOp::Mul => {
                let left = to_poly(left, var, values);
                let right = to_poly(right, var, values);
                if let Some(hard) = poly_hard(&left, &right) {
                    return hard;
                }
                match (left, right) {
                    (PolyOutcome::Poly(left), PolyOutcome::Poly(right)) => match op {
                        BinOp::Add => ensure_finite(left.add(&right)),
                        BinOp::Sub => ensure_finite(left.sub(&right)),
                        BinOp::Mul => {
                            let product = left.mul(&right);
                            if product.degree() > 64 {
                                PolyOutcome::NotPolynomial
                            } else {
                                ensure_finite(product)
                            }
                        }
                        _ => PolyOutcome::NotPolynomial,
                    },
                    _ => PolyOutcome::NotPolynomial,
                }
            }
            BinOp::Div => divide_poly(left, right, var, values),
            BinOp::Pow => power_poly(left, right, var, values),
        },
    }
}

fn poly_hard(left: &PolyOutcome, right: &PolyOutcome) -> Option<PolyOutcome> {
    if matches!(left, PolyOutcome::DivisionByZero) || matches!(right, PolyOutcome::DivisionByZero) {
        return Some(PolyOutcome::DivisionByZero);
    }
    if matches!(left, PolyOutcome::NonFinite) || matches!(right, PolyOutcome::NonFinite) {
        return Some(PolyOutcome::NonFinite);
    }
    if matches!(left, PolyOutcome::NotPolynomial) || matches!(right, PolyOutcome::NotPolynomial) {
        return Some(PolyOutcome::NotPolynomial);
    }
    None
}

fn divide_poly(
    left: &Expr,
    right: &Expr,
    var: &str,
    values: &BTreeMap<String, f64>,
) -> PolyOutcome {
    let numerator = to_poly(left, var, values);
    let denominator = to_poly(right, var, values);
    if matches!(&numerator, PolyOutcome::DivisionByZero)
        || matches!(&denominator, PolyOutcome::DivisionByZero)
    {
        return PolyOutcome::DivisionByZero;
    }
    if matches!(&numerator, PolyOutcome::NonFinite)
        || matches!(&denominator, PolyOutcome::NonFinite)
    {
        return PolyOutcome::NonFinite;
    }
    let PolyOutcome::Poly(denominator) = denominator else {
        return PolyOutcome::NotPolynomial;
    };
    if denominator.is_zero() {
        return PolyOutcome::DivisionByZero;
    }
    if denominator.degree() > 0 {
        return PolyOutcome::NotPolynomial;
    }
    let PolyOutcome::Poly(numerator) = numerator else {
        return PolyOutcome::NotPolynomial;
    };
    let divisor = denominator.coeffs[0];
    if !divisor.is_finite() {
        return PolyOutcome::NonFinite;
    }
    ensure_finite(numerator.scale(1.0 / divisor))
}

fn power_poly(left: &Expr, right: &Expr, var: &str, values: &BTreeMap<String, f64>) -> PolyOutcome {
    let base = match to_poly(left, var, values) {
        PolyOutcome::Poly(base) => base,
        other => return other,
    };
    let exponent = match right {
        Expr::Number(value) if value.is_finite() => *value,
        Expr::Number(_) => return PolyOutcome::NonFinite,
        _ => return PolyOutcome::NotPolynomial,
    };
    if base.degree() == 0 {
        let value = base.coeffs[0].powf(exponent);
        return if value.is_finite() {
            PolyOutcome::Poly(Poly::constant(value))
        } else {
            PolyOutcome::NonFinite
        };
    }
    if exponent < 0.0 || exponent.fract() != 0.0 || exponent > 64.0 {
        return PolyOutcome::NotPolynomial;
    }
    if (base.degree() as f64) * exponent > 64.0 {
        return PolyOutcome::NotPolynomial;
    }
    match base.pow(exponent as u32, 64) {
        Some(poly) => ensure_finite(poly),
        None => PolyOutcome::NotPolynomial,
    }
}

fn solve_poly(poly: Poly) -> UnivariateOutcome {
    let poly = poly.trimmed();
    if poly.is_zero() {
        return UnivariateOutcome::Identity;
    }
    match poly.degree() {
        0 => UnivariateOutcome::NoRealRoots,
        1 => {
            let root = -poly.coeffs[0] / poly.coeffs[1];
            if root.is_finite() {
                UnivariateOutcome::Roots(vec![root])
            } else {
                UnivariateOutcome::NonFinite
            }
        }
        2 => solve_quadratic(&poly),
        degree => solve_pure_power(&poly, degree),
    }
}

fn solve_quadratic(poly: &Poly) -> UnivariateOutcome {
    let a = poly.coeffs[2];
    let b = poly.coeffs[1];
    let c = poly.coeffs[0];
    let discriminant = b * b - 4.0 * a * c;
    if !discriminant.is_finite() {
        return UnivariateOutcome::NonFinite;
    }
    if approx_eq(discriminant, 0.0) {
        let root = -b / (2.0 * a);
        return if root.is_finite() {
            UnivariateOutcome::Roots(vec![root])
        } else {
            UnivariateOutcome::NonFinite
        };
    }
    if discriminant < 0.0 {
        return UnivariateOutcome::NoRealRoots;
    }
    let square_root = discriminant.sqrt();
    let mut roots = vec![
        (-b - square_root) / (2.0 * a),
        (-b + square_root) / (2.0 * a),
    ];
    if roots.iter().any(|root| !root.is_finite()) {
        return UnivariateOutcome::NonFinite;
    }
    roots.sort_by(|a, b| b.total_cmp(a));
    UnivariateOutcome::Roots(roots)
}

fn solve_pure_power(poly: &Poly, degree: usize) -> UnivariateOutcome {
    for coeff in &poly.coeffs[1..degree] {
        if !approx_eq(*coeff, 0.0) {
            return UnivariateOutcome::Unsolved;
        }
    }
    let target = -poly.coeffs[0] / poly.coeffs[degree];
    if !target.is_finite() {
        return UnivariateOutcome::NonFinite;
    }
    if approx_eq(target, 0.0) {
        return UnivariateOutcome::Roots(vec![0.0]);
    }
    let magnitude = target.abs().powf(1.0 / degree as f64);
    if !magnitude.is_finite() {
        return UnivariateOutcome::NonFinite;
    }
    if degree % 2 == 0 {
        if target < 0.0 {
            return UnivariateOutcome::NoRealRoots;
        }
        UnivariateOutcome::Roots(vec![magnitude, -magnitude])
    } else {
        let root = if target < 0.0 { -magnitude } else { magnitude };
        UnivariateOutcome::Roots(vec![root])
    }
}

#[cfg(test)]
mod linear {
    use super::*;
    use crate::format::approx_eq;

    fn form(terms: &[(&str, f64)], constant: f64) -> LinearForm {
        LinearForm {
            coeffs: terms
                .iter()
                .map(|(name, coeff)| ((*name).to_owned(), *coeff))
                .collect(),
            constant,
        }
    }

    #[test]
    fn single_assignment() {
        let mut system = LinearSystem::new();
        assert_eq!(
            system.add(form(&[("x", 1.0)], -5.0)),
            AddOutcome::Consistent
        );
        assert_eq!(system.values().get("x"), Some(&5.0));
    }

    #[test]
    fn two_by_two() {
        let mut system = LinearSystem::new();
        assert_eq!(
            system.add(form(&[("x", 1.0), ("y", 1.0)], -3.0)),
            AddOutcome::Consistent
        );
        assert_eq!(
            system.add(form(&[("x", 1.0), ("y", -1.0)], -1.0)),
            AddOutcome::Consistent
        );
        let values = system.values();
        assert!(approx_eq(*values.get("x").unwrap(), 2.0));
        assert!(approx_eq(*values.get("y").unwrap(), 1.0));
    }

    #[test]
    fn underdetermined_row_has_no_values() {
        let mut system = LinearSystem::new();
        assert_eq!(
            system.add(form(&[("x", 1.0), ("y", 1.0)], -3.0)),
            AddOutcome::Consistent
        );
        assert!(system.values().is_empty());
    }

    #[test]
    fn duplicate_row_is_dependent() {
        let mut system = LinearSystem::new();
        assert_eq!(
            system.add(form(&[("x", 1.0), ("y", 1.0)], -3.0)),
            AddOutcome::Consistent
        );
        assert_eq!(
            system.add(form(&[("x", 2.0), ("y", 2.0)], -6.0)),
            AddOutcome::Consistent
        );
        assert!(system.values().is_empty());
    }

    #[test]
    fn contradiction_is_rejected_without_mutation() {
        let mut system = LinearSystem::new();
        assert_eq!(
            system.add(form(&[("x", 1.0), ("y", 1.0)], -3.0)),
            AddOutcome::Consistent
        );
        assert_eq!(
            system.add(form(&[("x", 2.0), ("y", 2.0)], -7.0)),
            AddOutcome::Inconsistent
        );
        assert!(system.values().is_empty());
    }

    #[test]
    fn duplicate_assignment_keeps_value() {
        let mut system = LinearSystem::new();
        assert_eq!(
            system.add(form(&[("x", 1.0)], -5.0)),
            AddOutcome::Consistent
        );
        assert_eq!(
            system.add(form(&[("x", 1.0)], -5.0)),
            AddOutcome::Consistent
        );
        assert_eq!(system.values().get("x"), Some(&5.0));
    }

    #[test]
    fn conflicting_assignment_keeps_first_value() {
        let mut system = LinearSystem::new();
        assert_eq!(
            system.add(form(&[("x", 1.0)], -5.0)),
            AddOutcome::Consistent
        );
        assert_eq!(
            system.add(form(&[("x", 1.0)], -6.0)),
            AddOutcome::Inconsistent
        );
        assert_eq!(system.values().get("x"), Some(&5.0));
    }

    #[test]
    fn partially_determined_system_returns_only_singletons() {
        let mut system = LinearSystem::new();
        assert_eq!(
            system.add(form(&[("x", 1.0)], -2.0)),
            AddOutcome::Consistent
        );
        assert_eq!(
            system.add(form(&[("y", 1.0), ("z", 1.0)], -3.0)),
            AddOutcome::Consistent
        );
        let values = system.values();
        assert_eq!(values.get("x"), Some(&2.0));
        assert!(!values.contains_key("y"));
        assert!(!values.contains_key("z"));
    }

    #[test]
    fn substitution_updates_values() {
        let mut system = LinearSystem::new();
        assert_eq!(
            system.add(form(&[("x", 1.0)], -2.0)),
            AddOutcome::Consistent
        );
        assert_eq!(
            system.add(form(&[("x", 1.0), ("y", 1.0)], -5.0)),
            AddOutcome::Consistent
        );
        let values = system.values();
        assert_eq!(values.get("x"), Some(&2.0));
        assert_eq!(values.get("y"), Some(&3.0));
    }

    #[test]
    fn zero_rows() {
        let mut system = LinearSystem::new();
        assert_eq!(system.add(form(&[], 0.0)), AddOutcome::Consistent);
        assert_eq!(system.add(form(&[], -1.0)), AddOutcome::Inconsistent);
        assert!(system.values().is_empty());
    }

    #[test]
    fn tolerance_accepts_rounding_noise() {
        let mut system = LinearSystem::new();
        assert_eq!(
            system.add(form(&[("x", 1.0)], -(0.1 + 0.2))),
            AddOutcome::Consistent
        );
        assert_eq!(
            system.add(form(&[("x", 1.0)], -0.3)),
            AddOutcome::Consistent
        );
        assert!(approx_eq(*system.values().get("x").unwrap(), 0.3));
    }

    #[test]
    fn variable_order_is_deterministic() {
        let mut system = LinearSystem::new();
        assert_eq!(
            system.add(form(&[("b", 1.0)], -1.0)),
            AddOutcome::Consistent
        );
        assert_eq!(
            system.add(form(&[("a", 1.0)], -2.0)),
            AddOutcome::Consistent
        );
        let values = system.values();
        assert_eq!(
            values.keys().cloned().collect::<Vec<_>>(),
            vec!["a".to_owned(), "b".to_owned()]
        );
    }
}

#[cfg(test)]
mod polynomial {
    use super::*;
    use crate::ParseOutcome;
    use crate::format::approx_eq;

    fn expr(input: &str) -> Expr {
        match crate::parse(&format!("a = {input}")).unwrap() {
            ParseOutcome::Equation(equation) => equation.right,
            other => panic!("expected equation, got {other:?}"),
        }
    }

    fn empty() -> BTreeMap<String, f64> {
        BTreeMap::new()
    }

    fn known(pairs: &[(&str, f64)]) -> BTreeMap<String, f64> {
        pairs
            .iter()
            .map(|(name, value)| ((*name).to_owned(), *value))
            .collect()
    }

    fn linear(terms: &[(&str, f64)], constant: f64) -> LinearizeOutcome {
        LinearizeOutcome::Linear(LinearForm {
            coeffs: terms
                .iter()
                .map(|(name, coeff)| ((*name).to_owned(), *coeff))
                .collect(),
            constant,
        })
    }

    fn assert_roots(outcome: UnivariateOutcome, expected: &[f64]) {
        match outcome {
            UnivariateOutcome::Roots(roots) => {
                assert_eq!(roots.len(), expected.len(), "roots: {roots:?}");
                for (root, expected) in roots.iter().zip(expected) {
                    assert!(approx_eq(*root, *expected), "{root} != {expected}");
                }
            }
            other => panic!("expected roots, got {other:?}"),
        }
    }

    #[test]
    fn linearizes_products_of_variables_as_nonlinear() {
        assert_eq!(
            linearize(&expr("m * a"), &empty()),
            LinearizeOutcome::Nonlinear
        );
    }

    #[test]
    fn linearizes_affine_expressions() {
        assert_eq!(
            linearize(&expr("2 * x + 3"), &empty()),
            linear(&[("x", 2.0)], 3.0)
        );
        assert_eq!(
            linearize(&expr("x - 2"), &empty()),
            linear(&[("x", 1.0)], -2.0)
        );
        assert_eq!(
            linearize(&expr("-x"), &empty()),
            linear(&[("x", -1.0)], 0.0)
        );
    }

    #[test]
    fn substitutes_known_values() {
        let values = known(&[("x", 5.0)]);
        assert_eq!(
            linearize(&expr("x"), &values),
            LinearizeOutcome::Numeric(5.0)
        );
        assert_eq!(
            linearize(&expr("2 * x + 1"), &values),
            LinearizeOutcome::Numeric(11.0)
        );
    }

    #[test]
    fn divides_by_constants_and_rejects_zero() {
        assert_eq!(
            linearize(&expr("x / 2"), &empty()),
            linear(&[("x", 0.5)], 0.0)
        );
        assert_eq!(
            linearize(&expr("x / 0"), &empty()),
            LinearizeOutcome::DivisionByZero
        );
        assert_eq!(
            linearize(&expr("0 / 0"), &empty()),
            LinearizeOutcome::DivisionByZero
        );
    }

    #[test]
    fn rejects_variable_denominators() {
        assert_eq!(
            linearize(&expr("2 / x"), &empty()),
            LinearizeOutcome::Nonlinear
        );
    }

    #[test]
    fn evaluates_numeric_powers_and_rejects_variable_powers() {
        assert_eq!(
            linearize(&expr("2 ^ 3"), &empty()),
            LinearizeOutcome::Numeric(8.0)
        );
        assert_eq!(
            linearize(&expr("2 ^ x"), &empty()),
            LinearizeOutcome::Nonlinear
        );
        assert_eq!(
            linearize(&expr("x ^ 2"), &empty()),
            LinearizeOutcome::Nonlinear
        );
        assert_eq!(
            linearize(&expr("x ^ 1"), &empty()),
            linear(&[("x", 1.0)], 0.0)
        );
    }

    #[test]
    fn normalizes_cancelling_terms() {
        assert_eq!(
            linearize(&expr("x - x"), &empty()),
            LinearizeOutcome::Numeric(0.0)
        );
        assert_eq!(
            linearize(&expr("0 * x"), &empty()),
            LinearizeOutcome::Numeric(0.0)
        );
    }

    #[test]
    fn plus_minus_is_nonlinear() {
        assert_eq!(
            linearize(&expr("±2"), &empty()),
            LinearizeOutcome::Nonlinear
        );
    }

    #[test]
    fn propagates_non_finite_arithmetic() {
        let product = Expr::Binary {
            op: BinOp::Mul,
            left: Box::new(Expr::Number(1e308)),
            right: Box::new(Expr::Number(1e308)),
        };
        assert_eq!(linearize(&product, &empty()), LinearizeOutcome::NonFinite);
        assert_eq!(
            solve_univariate(&product, "x", &empty()),
            UnivariateOutcome::NonFinite
        );
    }

    #[test]
    fn solves_linear_and_quadratic_equations() {
        assert_roots(solve_univariate(&expr("x - 5"), "x", &empty()), &[5.0]);
        assert_roots(
            solve_univariate(&expr("x^2 - 4"), "x", &empty()),
            &[2.0, -2.0],
        );
        assert_roots(
            solve_univariate(&expr("x^2 + x"), "x", &empty()),
            &[0.0, -1.0],
        );
        assert_roots(
            solve_univariate(&expr("x^2 - 2 * x + 1"), "x", &empty()),
            &[1.0],
        );
        assert_eq!(
            solve_univariate(&expr("x^2 + 1"), "x", &empty()),
            UnivariateOutcome::NoRealRoots
        );
    }

    #[test]
    fn solves_pure_powers() {
        assert_roots(solve_univariate(&expr("x^3 - 8"), "x", &empty()), &[2.0]);
        assert_roots(solve_univariate(&expr("x^3 + 8"), "x", &empty()), &[-2.0]);
        assert_roots(
            solve_univariate(&expr("x^4 - 16"), "x", &empty()),
            &[2.0, -2.0],
        );
        assert_roots(solve_univariate(&expr("x^3"), "x", &empty()), &[0.0]);
        assert_roots(solve_univariate(&expr("x^4"), "x", &empty()), &[0.0]);
        assert_eq!(
            solve_univariate(&expr("x^4 + 16"), "x", &empty()),
            UnivariateOutcome::NoRealRoots
        );
    }

    #[test]
    fn solves_identity_and_rejects_unsupported_degrees() {
        assert_eq!(
            solve_univariate(&expr("0"), "x", &empty()),
            UnivariateOutcome::Identity
        );
        assert_eq!(
            solve_univariate(&expr("x - x"), "x", &empty()),
            UnivariateOutcome::Identity
        );
        assert_eq!(
            solve_univariate(&expr("x^3 + x"), "x", &empty()),
            UnivariateOutcome::Unsolved
        );
    }

    #[test]
    fn rejects_unknown_exponents_and_the_degree_cap() {
        assert_eq!(
            solve_univariate(&expr("x^y"), "x", &empty()),
            UnivariateOutcome::Unsolved
        );
        assert_eq!(
            solve_univariate(&expr("x^65"), "x", &empty()),
            UnivariateOutcome::Unsolved
        );
    }

    #[test]
    fn substitutes_other_known_variables() {
        let values = known(&[("a", 2.0)]);
        assert_roots(solve_univariate(&expr("x + a"), "x", &values), &[-2.0]);
        assert_eq!(
            solve_univariate(&expr("x + y"), "x", &empty()),
            UnivariateOutcome::Unsolved
        );
    }

    #[test]
    fn reports_division_by_zero() {
        assert_eq!(
            solve_univariate(&expr("x / 0"), "x", &empty()),
            UnivariateOutcome::DivisionByZero
        );
        assert_eq!(
            solve_univariate(&expr("1 / 0"), "x", &empty()),
            UnivariateOutcome::DivisionByZero
        );
    }
}

#[cfg(test)]
mod rational {
    use super::*;
    use crate::ParseOutcome;
    use crate::format::approx_eq;

    fn expr(input: &str) -> Expr {
        match crate::parse(&format!("a = {input}")).unwrap() {
            ParseOutcome::Equation(equation) => equation.right,
            other => panic!("expected equation, got {other:?}"),
        }
    }

    fn empty() -> BTreeMap<String, f64> {
        BTreeMap::new()
    }

    fn assert_roots(outcome: UnivariateOutcome, expected: &[f64]) {
        match outcome {
            UnivariateOutcome::Roots(roots) => {
                assert_eq!(roots.len(), expected.len(), "roots: {roots:?}");
                for (root, expected) in roots.iter().zip(expected) {
                    assert!(approx_eq(*root, *expected), "{root} != {expected}");
                }
            }
            other => panic!("expected roots, got {other:?}"),
        }
    }

    #[test]
    fn solves_simple_rational_equations() {
        assert_roots(solve_univariate(&expr("1 / x - 2"), "x", &empty()), &[0.5]);
        assert_roots(
            solve_univariate(&expr("x / (x + 1) - 2"), "x", &empty()),
            &[-2.0],
        );
    }

    #[test]
    fn cancelling_numerator_and_denominator() {
        assert_eq!(
            solve_univariate(&expr("x / x - 2"), "x", &empty()),
            UnivariateOutcome::NoRealRoots
        );
        assert_eq!(
            solve_univariate(&expr("x / x - 1"), "x", &empty()),
            UnivariateOutcome::Identity
        );
    }

    #[test]
    fn divides_by_zero() {
        assert_eq!(
            solve_univariate(&expr("1 / 0 - 2"), "x", &empty()),
            UnivariateOutcome::DivisionByZero
        );
    }

    #[test]
    fn constant_numerator_has_no_roots() {
        assert_eq!(
            solve_univariate(&expr("1 / (x - 1)"), "x", &empty()),
            UnivariateOutcome::NoRealRoots
        );
    }

    #[test]
    fn supports_a_quadratic_numerator() {
        assert_roots(
            solve_univariate(&expr("(x^2 - 4) / (x - 1)"), "x", &empty()),
            &[2.0, -2.0],
        );
    }

    #[test]
    fn rejects_an_out_of_scope_denominator() {
        assert_eq!(
            solve_univariate(&expr("1 / (x^2 + 1) - 2"), "x", &empty()),
            UnivariateOutcome::Unsolved
        );
    }

    #[test]
    fn filters_domain_rejected_roots() {
        assert_roots(
            solve_univariate(&expr("(x^2 - 1) / (x - 1)"), "x", &empty()),
            &[-1.0],
        );
    }

    #[test]
    fn supports_negative_integer_powers() {
        assert_roots(solve_univariate(&expr("x^-1 - 2"), "x", &empty()), &[0.5]);
    }
}
