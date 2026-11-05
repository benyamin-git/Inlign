//! Tokenizer for the engine grammar.

/// The lexical form of one token.
#[derive(Debug, Clone, PartialEq)]
pub enum TokenKind {
    Number(f64),
    Name(String),
    Plus,
    Minus,
    Star,
    Slash,
    Caret,
    PlusMinus,
    LParen,
    RParen,
    Eq,
    Eof,
}

/// A token and its byte range in the source line.
#[derive(Debug, Clone, PartialEq)]
pub struct Token {
    pub kind: TokenKind,
    pub start: usize,
    pub end: usize,
}

/// A lexical failure; the parser maps every variant to `invalid`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LexError {
    InvalidChar,
    InvalidNumber,
}

/// True when the next non-whitespace character starts a name.
fn next_is_name(input: &str, start: usize) -> bool {
    input[start..]
        .chars()
        .find(|ch| !ch.is_whitespace())
        .is_some_and(|ch| ch.is_ascii_alphabetic() || ch == '_')
}

/// Tokenizes one line, normalizing the typographic operator aliases.
pub fn lex(input: &str) -> Result<Vec<Token>, LexError> {
    let mut tokens = Vec::new();
    let mut i = 0;
    while i < input.len() {
        let ch = input[i..].chars().next().ok_or(LexError::InvalidChar)?;
        if ch.is_whitespace() {
            i += ch.len_utf8();
            continue;
        }
        let start = i;
        let kind = match ch {
            '+' => {
                i += 1;
                TokenKind::Plus
            }
            '-' => {
                i += 1;
                TokenKind::Minus
            }
            '*' => {
                i += 1;
                TokenKind::Star
            }
            '/' => {
                i += 1;
                TokenKind::Slash
            }
            '^' => {
                i += 1;
                TokenKind::Caret
            }
            '(' => {
                i += 1;
                TokenKind::LParen
            }
            ')' => {
                i += 1;
                TokenKind::RParen
            }
            '=' => {
                i += 1;
                TokenKind::Eq
            }
            '−' => {
                i += ch.len_utf8();
                TokenKind::Minus
            }
            '×' | '·' => {
                i += ch.len_utf8();
                TokenKind::Star
            }
            '÷' => {
                i += ch.len_utf8();
                TokenKind::Slash
            }
            '±' => {
                i += ch.len_utf8();
                TokenKind::PlusMinus
            }
            '.' if matches!(
                tokens.last(),
                Some(Token {
                    kind: TokenKind::Name(_),
                    ..
                })
            ) && next_is_name(input, i + 1) =>
            {
                // A dot between names is multiplication; dots in numbers
                // remain decimal separators.
                i += 1;
                TokenKind::Star
            }
            _ if ch.is_ascii_digit() => {
                let mut j = i;
                while j < input.len() && input.as_bytes()[j].is_ascii_digit() {
                    j += 1;
                }
                if j < input.len() && input.as_bytes()[j] == b'.' {
                    j += 1;
                    while j < input.len() && input.as_bytes()[j].is_ascii_digit() {
                        j += 1;
                    }
                }
                if j < input.len() && input.as_bytes()[j] == b'_' {
                    return Err(LexError::InvalidChar);
                }
                let number = input[i..j]
                    .parse::<f64>()
                    .map_err(|_| LexError::InvalidNumber)?;
                if !number.is_finite() {
                    return Err(LexError::InvalidNumber);
                }
                i = j;
                TokenKind::Number(number)
            }
            _ if ch.is_ascii_alphabetic() || ch == '_' => {
                let mut j = i;
                while j < input.len() {
                    let byte = input.as_bytes()[j];
                    if byte.is_ascii_alphanumeric() || byte == b'_' {
                        j += 1;
                    } else {
                        break;
                    }
                }
                i = j;
                TokenKind::Name(input[start..j].to_owned())
            }
            _ => return Err(LexError::InvalidChar),
        };
        tokens.push(Token {
            kind,
            start,
            end: i,
        });
    }
    tokens.push(Token {
        kind: TokenKind::Eof,
        start: i,
        end: i,
    });
    Ok(tokens)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn kinds(input: &str) -> Vec<TokenKind> {
        lex(input)
            .unwrap()
            .into_iter()
            .map(|token| token.kind)
            .collect()
    }

    #[test]
    fn aliases_map_to_ascii_operators() {
        assert_eq!(kinds("−"), vec![TokenKind::Minus, TokenKind::Eof]);
        assert_eq!(kinds("×"), vec![TokenKind::Star, TokenKind::Eof]);
        assert_eq!(kinds("·"), vec![TokenKind::Star, TokenKind::Eof]);
        assert_eq!(kinds("÷"), vec![TokenKind::Slash, TokenKind::Eof]);
        assert_eq!(kinds("±"), vec![TokenKind::PlusMinus, TokenKind::Eof]);
    }

    #[test]
    fn tokenizes_an_expression_in_precedence_order() {
        assert_eq!(
            kinds("a + b * (c - 2) / d ^ e = 3"),
            vec![
                TokenKind::Name("a".into()),
                TokenKind::Plus,
                TokenKind::Name("b".into()),
                TokenKind::Star,
                TokenKind::LParen,
                TokenKind::Name("c".into()),
                TokenKind::Minus,
                TokenKind::Number(2.0),
                TokenKind::RParen,
                TokenKind::Slash,
                TokenKind::Name("d".into()),
                TokenKind::Caret,
                TokenKind::Name("e".into()),
                TokenKind::Eq,
                TokenKind::Number(3.0),
                TokenKind::Eof,
            ]
        );
    }

    #[test]
    fn names_are_multi_letter_and_case_sensitive() {
        assert_eq!(
            kinds("foo Foo _bar a1 _ xy"),
            vec![
                TokenKind::Name("foo".into()),
                TokenKind::Name("Foo".into()),
                TokenKind::Name("_bar".into()),
                TokenKind::Name("a1".into()),
                TokenKind::Name("_".into()),
                TokenKind::Name("xy".into()),
                TokenKind::Eof,
            ]
        );
    }

    #[test]
    fn a_dot_between_names_is_multiplication() {
        assert_eq!(
            kinds("x.y alpha . beta"),
            vec![
                TokenKind::Name("x".into()),
                TokenKind::Star,
                TokenKind::Name("y".into()),
                TokenKind::Name("alpha".into()),
                TokenKind::Star,
                TokenKind::Name("beta".into()),
                TokenKind::Eof,
            ]
        );
    }

    #[test]
    fn numbers_accept_the_approved_forms() {
        assert_eq!(
            kinds("5 5.5 5. 0.001"),
            vec![
                TokenKind::Number(5.0),
                TokenKind::Number(5.5),
                TokenKind::Number(5.0),
                TokenKind::Number(0.001),
                TokenKind::Eof,
            ]
        );
    }

    #[test]
    fn leading_dot_and_second_dot_are_errors() {
        assert_eq!(lex(".5"), Err(LexError::InvalidChar));
        assert_eq!(lex("1.2.3"), Err(LexError::InvalidChar));
        assert_eq!(lex("1_000"), Err(LexError::InvalidChar));
        assert_eq!(lex("x.5"), Err(LexError::InvalidChar));
    }

    #[test]
    fn whitespace_is_skipped_and_offsets_are_bytes() {
        let tokens = lex(" 12 + x").unwrap();
        assert_eq!(tokens.len(), 4);
        assert_eq!(tokens[0].kind, TokenKind::Number(12.0));
        assert_eq!((tokens[0].start, tokens[0].end), (1, 3));
        assert_eq!(tokens[1].kind, TokenKind::Plus);
        assert_eq!((tokens[1].start, tokens[1].end), (4, 5));
        assert_eq!(tokens[2].kind, TokenKind::Name("x".into()));
        assert_eq!((tokens[2].start, tokens[2].end), (6, 7));
        assert_eq!(tokens[3].kind, TokenKind::Eof);
        assert_eq!((tokens[3].start, tokens[3].end), (7, 7));

        let tokens = lex("2×3").unwrap();
        assert_eq!((tokens[1].start, tokens[1].end), (1, 3));
        assert_eq!((tokens[2].start, tokens[2].end), (3, 4));
    }

    #[test]
    fn unknown_characters_are_errors() {
        for input in [",", "%", "[", "]", "<", ">", "é", "≠"] {
            assert_eq!(lex(input), Err(LexError::InvalidChar), "{input}");
        }
    }

    #[test]
    fn empty_input_is_eof() {
        assert_eq!(kinds(""), vec![TokenKind::Eof]);
        assert_eq!(kinds(" \t\n"), vec![TokenKind::Eof]);
    }
}
