//! Pure Rust core for Inlign.
//!
//! Nothing math-related lives here yet: only `version()` crosses into Rust in
//! this milestone.

/// Returns the crate version.
pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg(test)]
mod tests {
    use super::version;

    #[test]
    fn version_is_the_workspace_version() {
        assert_eq!(version(), "0.1.0");
    }
}
