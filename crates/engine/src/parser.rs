//! Recursive-descent parser for one equation line.

use crate::ast::{BinOp, Equation, Expr};
use crate::lexer::{self, Token, TokenKind};

/// A line that stops before it is complete; only an empty RHS carries an
/// assignment name for the suggestion path.
#[derive(Debug, Clone, PartialEq)]
pub struct IncompleteLine {
    pub assignment: Option<String>,
}

/// The two successful parses of a line.
#[derive(Debug, Clone, PartialEq)]
pub enum ParseOutcome {
    Equation(Equation),
    Incomplete(IncompleteLine),
}

/// The only parser failure; every variant is reported as `invalid`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ParseError {
    Invalid,
}

/// Parses one line, distinguishing incomplete syntax from invalid syntax.
pub fn parse(input: &str) -> Result<ParseOutcome, ParseError> {
    let tokens = lexer::lex(input).map_err(|_| ParseError::Invalid)?;
    let mut parser = Parser { tokens, pos: 0 };
    match parser.line() {
        Ok(outcome) => Ok(outcome),
        Err(Error::Invalid) => Err(ParseError::Invalid),
        Err(Error::Incomplete) => Ok(ParseOutcome::Incomplete(IncompleteLine {
            assignment: None,
        })),
    }
}

enum Error {
    Invalid,
    Incomplete,
}

struct Parser {
    tokens: Vec<Token>,
    pos: usize,
}

impl Parser {
    fn peek(&self) -> &TokenKind {
        &self.tokens[self.pos].kind
    }

    fn advance(&mut self) {
        if self.pos + 1 < self.tokens.len() {
            self.pos += 1;
        }
    }

    fn at_eof(&self) -> bool {
        matches!(self.peek(), TokenKind::Eof)
    }

    fn at_eq(&self) -> bool {
        matches!(self.peek(), TokenKind::Eq)
    }

    fn line(&mut self) -> Result<ParseOutcome, Error> {
        let left = self.expression()?;
        if self.at_eq() {
            self.advance();
            if self.at_eof() {
                let assignment = match &left {
                    Expr::Var(name) => Some(name.clone()),
                    _ => None,
                };
                Ok(ParseOutcome::Incomplete(IncompleteLine { assignment }))
            } else {
                let right = self.expression()?;
                if self.at_eof() {
                    Ok(ParseOutcome::Equation(Equation { left, right }))
                } else {
                    Err(Error::Invalid)
                }
            }
        } else if self.at_eof() && matches!(&left, Expr::Var(_)) {
            Ok(ParseOutcome::Incomplete(IncompleteLine {
                assignment: None,
            }))
        } else {
            Err(Error::Invalid)
        }
    }

    fn expression(&mut self) -> Result<Expr, Error> {
        let mut left = self.term()?;
        loop {
            let op = match self.peek() {
                TokenKind::Plus => BinOp::Add,
                TokenKind::Minus => BinOp::Sub,
                _ => break,
            };
            self.advance();
            let right = self.term()?;
            left = Expr::Binary {
                op,
                left: Box::new(left),
                right: Box::new(right),
            };
        }
        Ok(left)
    }

    fn term(&mut self) -> Result<Expr, Error> {
        let mut left = self.unary()?;
        loop {
            let op = match self.peek() {
                TokenKind::Star => BinOp::Mul,
                TokenKind::Slash => BinOp::Div,
                _ => break,
            };
            self.advance();
            let right = self.unary()?;
            left = Expr::Binary {
                op,
                left: Box::new(left),
                right: Box::new(right),
            };
        }
        Ok(left)
    }

    fn unary(&mut self) -> Result<Expr, Error> {
        match self.peek().clone() {
            TokenKind::Minus => {
                self.advance();
                Ok(Expr::Neg(Box::new(self.unary()?)))
            }
            TokenKind::PlusMinus => {
                self.advance();
                Ok(Expr::PlusMinus(Box::new(self.unary()?)))
            }
            _ => self.power(),
        }
    }

    fn power(&mut self) -> Result<Expr, Error> {
        let base = self.primary()?;
        if matches!(self.peek(), TokenKind::Caret) {
            self.advance();
            let exponent = self.unary()?;
            Ok(Expr::Binary {
                op: BinOp::Pow,
                left: Box::new(base),
                right: Box::new(exponent),
            })
        } else {
            Ok(base)
        }
    }

    fn primary(&mut self) -> Result<Expr, Error> {
        match self.peek().clone() {
            TokenKind::Number(value) => {
                self.advance();
                Ok(Expr::Number(value))
            }
            TokenKind::Name(name) => {
                self.advance();
                Ok(Expr::Var(name))
            }
            TokenKind::LParen => {
                self.advance();
                let expression = self.expression()?;
                match self.peek().clone() {
                    TokenKind::RParen => {
                        self.advance();
                        Ok(expression)
                    }
                    TokenKind::Eof => Err(Error::Incomplete),
                    _ => Err(Error::Invalid),
                }
            }
            TokenKind::Eof => Err(Error::Incomplete),
            _ => Err(Error::Invalid),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn equation(input: &str) -> Equation {
        match parse(input).unwrap() {
            ParseOutcome::Equation(equation) => equation,
            other => panic!("expected equation, got {other:?}"),
        }
    }

    fn incomplete(input: &str) -> IncompleteLine {
        match parse(input).unwrap() {
            ParseOutcome::Incomplete(line) => line,
            other => panic!("expected incomplete, got {other:?}"),
        }
    }

    fn number(value: f64) -> Expr {
        Expr::Number(value)
    }

    fn var(name: &str) -> Expr {
        Expr::Var(name.into())
    }

    fn binary(op: BinOp, left: Expr, right: Expr) -> Expr {
        Expr::Binary {
            op,
            left: Box::new(left),
            right: Box::new(right),
        }
    }

    #[test]
    fn parses_precedence() {
        assert_eq!(
            equation("a = 1 + 2 * 3"),
            Equation {
                left: var("a"),
                right: binary(
                    BinOp::Add,
                    number(1.0),
                    binary(BinOp::Mul, number(2.0), number(3.0)),
                ),
            }
        );
    }

    #[test]
    fn a_dot_between_names_is_multiplication() {
        assert_eq!(
            equation("a = x.y"),
            Equation {
                left: var("a"),
                right: binary(BinOp::Mul, var("x"), var("y")),
            }
        );
        assert_eq!(
            equation("a = x.y^2"),
            Equation {
                left: var("a"),
                right: binary(
                    BinOp::Mul,
                    var("x"),
                    binary(BinOp::Pow, var("y"), number(2.0)),
                ),
            }
        );
        assert_eq!(
            equation("a = alpha . beta"),
            Equation {
                left: var("a"),
                right: binary(BinOp::Mul, var("alpha"), var("beta")),
            }
        );
    }

    #[test]
    fn subtraction_is_left_associative() {
        assert_eq!(
            equation("a = 1 - 2 - 3"),
            Equation {
                left: var("a"),
                right: binary(
                    BinOp::Sub,
                    binary(BinOp::Sub, number(1.0), number(2.0)),
                    number(3.0),
                ),
            }
        );
    }

    #[test]
    fn powers_are_right_associative() {
        assert_eq!(
            equation("a = 2 ^ 3 ^ 2"),
            Equation {
                left: var("a"),
                right: binary(
                    BinOp::Pow,
                    number(2.0),
                    binary(BinOp::Pow, number(3.0), number(2.0)),
                ),
            }
        );
    }

    #[test]
    fn unary_minus_binds_before_power() {
        assert_eq!(
            equation("a = -2^2"),
            Equation {
                left: var("a"),
                right: Expr::Neg(Box::new(binary(BinOp::Pow, number(2.0), number(2.0),))),
            }
        );
        assert_eq!(
            equation("a = (-2)^2"),
            Equation {
                left: var("a"),
                right: binary(BinOp::Pow, Expr::Neg(Box::new(number(2.0))), number(2.0),),
            }
        );
    }

    #[test]
    fn plus_minus_is_a_prefix_unary() {
        assert_eq!(
            equation("a = ±2"),
            Equation {
                left: var("a"),
                right: Expr::PlusMinus(Box::new(number(2.0))),
            }
        );
        assert_eq!(
            equation("a = 2 + ±3"),
            Equation {
                left: var("a"),
                right: binary(
                    BinOp::Add,
                    number(2.0),
                    Expr::PlusMinus(Box::new(number(3.0))),
                ),
            }
        );
        assert_eq!(
            equation("a = ±2 * 3"),
            Equation {
                left: var("a"),
                right: binary(
                    BinOp::Mul,
                    Expr::PlusMinus(Box::new(number(2.0))),
                    number(3.0),
                ),
            }
        );
        assert_eq!(
            equation("a = ±2 ^ 2"),
            Equation {
                left: var("a"),
                right: Expr::PlusMinus(Box::new(binary(BinOp::Pow, number(2.0), number(2.0),))),
            }
        );
        assert_eq!(
            equation("a = 2 ^ ±3"),
            Equation {
                left: var("a"),
                right: binary(
                    BinOp::Pow,
                    number(2.0),
                    Expr::PlusMinus(Box::new(number(3.0))),
                ),
            }
        );
        assert_eq!(parse("a = 2 ± 3"), Err(ParseError::Invalid));
    }

    #[test]
    fn incomplete_table() {
        assert_eq!(incomplete("a"), IncompleteLine { assignment: None });
        assert_eq!(
            incomplete("a ="),
            IncompleteLine {
                assignment: Some("a".into())
            }
        );
        assert_eq!(
            incomplete("a =   "),
            IncompleteLine {
                assignment: Some("a".into())
            }
        );
        assert_eq!(incomplete("a + b ="), IncompleteLine { assignment: None });
        for input in ["a = 2 +", "a = 2 ^", "a = (", "a = (2 + 3"] {
            assert_eq!(
                incomplete(input),
                IncompleteLine { assignment: None },
                "{input}"
            );
        }
    }

    #[test]
    fn complete_table() {
        assert_eq!(
            equation("a = 2"),
            Equation {
                left: var("a"),
                right: number(2.0)
            }
        );
        assert_eq!(
            equation("a = -2"),
            Equation {
                left: var("a"),
                right: Expr::Neg(Box::new(number(2.0)))
            }
        );
        assert_eq!(
            equation("a = ±2"),
            Equation {
                left: var("a"),
                right: Expr::PlusMinus(Box::new(number(2.0)))
            }
        );
        assert!(matches!(
            parse("a = 2 ^ 3 ^ 2"),
            Ok(ParseOutcome::Equation(_))
        ));
    }

    #[test]
    fn invalid_table() {
        for input in [
            "2 + 2",
            "a + b",
            "hello world",
            "a = 2 3",
            "a = 2.x",
            "a = 2 + * 3",
            "a == 2",
            "a = 2 = 3",
            "= 2",
            "a = )",
        ] {
            assert_eq!(parse(input), Err(ParseError::Invalid), "{input}");
        }
    }

    #[test]
    fn lexical_errors_are_invalid() {
        for input in ["a = 1.2.3", "a = 2,3", "a = 2 % 3", "a = x.5"] {
            assert_eq!(parse(input), Err(ParseError::Invalid), "{input}");
        }
    }

    #[test]
    fn trailing_tokens_and_unclosed_parentheses() {
        assert_eq!(parse("a = 2 + 3 4"), Err(ParseError::Invalid));
        assert_eq!(parse("a = (2 + 3))"), Err(ParseError::Invalid));
        assert_eq!(
            incomplete("a = (2 + 3"),
            IncompleteLine { assignment: None }
        );
    }
}
