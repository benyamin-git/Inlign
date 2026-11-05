//! Pure Rust core for Inlign.
//!
//! The variable engine lives here: AST, lexer, parser, solver, formatting and
//! prefix evaluation. It has no WASM, DOM, React, storage or worker dependency.

pub mod ast;
pub mod evaluate;
pub mod format;
pub mod lexer;
pub mod parser;
pub mod solver;

pub use ast::{BinOp, Equation, Expr};
pub use evaluate::{InputLine, LineEvaluation, LineStatus, evaluate};
pub use format::{
    RELATIVE_TOLERANCE, SIGNIFICANT_DIGITS, Suggestion, approx_eq, format_set, format_value,
    suggestion_for,
};
pub use lexer::{LexError, Token, TokenKind, lex};
pub use parser::{IncompleteLine, ParseError, ParseOutcome, parse};
pub use solver::{
    AddOutcome, LinearForm, LinearSystem, LinearizeOutcome, UnivariateOutcome, linearize,
    solve_univariate,
};

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
