//! Number formatting, relative equality and suggestion text.

/// Relative tolerance used for every numeric comparison.
pub const RELATIVE_TOLERANCE: f64 = 1e-9;

/// Maximum significant digits in formatted values.
pub const SIGNIFICANT_DIGITS: u32 = 12;

/// A display/insertion pair for an empty-RHS assignment.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Suggestion {
    pub display: String,
    pub insert: String,
}

/// Compares finite values with the relative tolerance; non-finite values only
/// compare equal to themselves.
pub fn approx_eq(a: f64, b: f64) -> bool {
    if a == b {
        return true;
    }
    if !a.is_finite() || !b.is_finite() {
        return false;
    }
    (a - b).abs() <= RELATIVE_TOLERANCE * a.abs().max(b.abs()).max(1.0)
}

/// Formats one value with twelve significant digits and the shortest display.
pub fn format_value(value: f64) -> String {
    if !value.is_finite() {
        return "invalid".to_owned();
    }
    if value == 0.0 {
        return "0".to_owned();
    }
    let rounded = format!("{value:.11e}").parse::<f64>().unwrap_or(value);
    let mut text = rounded.to_string();
    if text.contains('.') {
        while text.ends_with('0') {
            text.pop();
        }
        if text.ends_with('.') {
            text.pop();
        }
    }
    if text == "-0" { "0".to_owned() } else { text }
}

fn normalized(values: &[f64]) -> Vec<f64> {
    let mut sorted = values.to_vec();
    sorted.sort_by(|a, b| b.total_cmp(a));
    let mut result: Vec<f64> = Vec::new();
    for value in sorted {
        if result.last().is_none_or(|last| !approx_eq(*last, value)) {
            result.push(value);
        }
    }
    result
}

/// Formats a set sorted descending, with `±v` for a symmetric pair.
pub fn format_set(values: &[f64]) -> String {
    let sorted = normalized(values);
    match sorted.as_slice() {
        [] => String::new(),
        [value] => format_value(*value),
        [a, b] if approx_eq(*a, -*b) => format!("±{}", format_value(a.abs())),
        _ => sorted
            .iter()
            .map(|value| format_value(*value))
            .collect::<Vec<_>>()
            .join(", "),
    }
}

/// Builds the display and insertion text for a value set.
pub fn suggestion_for(values: &[f64]) -> Option<Suggestion> {
    let sorted = normalized(values);
    match sorted.as_slice() {
        [] => None,
        [value] => {
            let text = format_value(*value);
            Some(Suggestion {
                display: text.clone(),
                insert: text,
            })
        }
        [a, b] if approx_eq(*a, -*b) => {
            let text = format!("±{}", format_value(a.abs()));
            Some(Suggestion {
                display: text.clone(),
                insert: text,
            })
        }
        _ => Some(Suggestion {
            display: format_set(&sorted),
            insert: format_value(sorted[0]),
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_plain_values() {
        assert_eq!(format_value(5.0), "5");
        assert_eq!(format_value(5.5), "5.5");
        assert_eq!(format_value(-2.0), "-2");
        assert_eq!(format_value(0.0), "0");
        assert_eq!(format_value(-0.0), "0");
        assert_eq!(format_value(5.5000), "5.5");
        assert_eq!(format_value(100.0), "100");
    }

    #[test]
    fn rounds_to_twelve_significant_digits() {
        assert_eq!(format_value(0.1 + 0.2), "0.3");
        assert_eq!(format_value(1.0 / 3.0), "0.333333333333");
    }

    #[test]
    fn non_finite_values_are_invalid() {
        assert_eq!(format_value(f64::NAN), "invalid");
        assert_eq!(format_value(f64::INFINITY), "invalid");
        assert_eq!(format_value(f64::NEG_INFINITY), "invalid");
    }

    #[test]
    fn formats_sets() {
        assert_eq!(format_set(&[2.0, -2.0]), "±2");
        assert_eq!(format_set(&[0.0, -1.0]), "0, -1");
        assert_eq!(format_set(&[2.0, 2.0]), "2");
        assert_eq!(format_set(&[2.0]), "2");
        assert_eq!(format_set(&[]), "");
    }

    #[test]
    fn suggests_values_and_sets() {
        assert_eq!(suggestion_for(&[]), None);
        assert_eq!(
            suggestion_for(&[5.0]),
            Some(Suggestion {
                display: "5".into(),
                insert: "5".into()
            })
        );
        assert_eq!(
            suggestion_for(&[2.0, -2.0]),
            Some(Suggestion {
                display: "±2".into(),
                insert: "±2".into()
            })
        );
        assert_eq!(
            suggestion_for(&[0.0, -1.0]),
            Some(Suggestion {
                display: "0, -1".into(),
                insert: "0".into()
            })
        );
    }

    #[test]
    fn tolerance_uses_relative_boundaries() {
        assert!(approx_eq(2.0, 2.0));
        assert!(approx_eq(1.0, 1.0 + 1e-10));
        assert!(!approx_eq(1.0, 1.0 + 1e-8));
        assert!(!approx_eq(f64::NAN, f64::NAN));
        assert!(approx_eq(f64::INFINITY, f64::INFINITY));
        assert!(!approx_eq(f64::INFINITY, f64::NEG_INFINITY));
        assert!(approx_eq(0.0, -0.0));
    }

    #[test]
    fn duplicate_roots_are_deduplicated() {
        assert_eq!(format_set(&[2.0, 2.0, 2.0]), "2");
        assert_eq!(
            suggestion_for(&[2.0, 2.0]),
            Some(Suggestion {
                display: "2".into(),
                insert: "2".into()
            })
        );
    }
}
