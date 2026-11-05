//! Equation syntax tree shared by the lexer, parser and solver.

/// A binary operator in an expression.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BinOp {
    Add,
    Sub,
    Mul,
    Div,
    Pow,
}

/// An expression on either side of an equation.
#[derive(Debug, Clone, PartialEq)]
pub enum Expr {
    Number(f64),
    Var(String),
    Neg(Box<Expr>),
    PlusMinus(Box<Expr>),
    Binary {
        op: BinOp,
        left: Box<Expr>,
        right: Box<Expr>,
    },
}

/// One complete equation, parsed but not yet classified.
#[derive(Debug, Clone, PartialEq)]
pub struct Equation {
    pub left: Expr,
    pub right: Expr,
}
