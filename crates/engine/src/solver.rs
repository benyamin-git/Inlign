//! Incremental linear algebra used by the prefix evaluator.

use std::collections::BTreeMap;

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
#[derive(Debug, Default)]
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
