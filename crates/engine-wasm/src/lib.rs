//! Thin `#[wasm_bindgen]` facade over `inlign-engine`.

use inlign_engine::{InputLine, LineEvaluation, LineStatus, Suggestion, evaluate as evaluate_core};
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

#[derive(Serialize, Deserialize)]
struct LineInputDto {
    id: String,
    text: String,
}

#[derive(Serialize, Deserialize)]
struct SuggestionDto {
    display: String,
    insert: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum LineStatusDto {
    Ok,
    Empty,
    Incomplete,
    Error,
    Skipped,
}

#[derive(Serialize, Deserialize)]
struct LineEvaluationDto {
    id: String,
    status: LineStatusDto,
    #[serde(skip_serializing_if = "Option::is_none")]
    suggestion: Option<SuggestionDto>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

/// Evaluates notebook lines and returns their annotations.
#[wasm_bindgen]
pub fn evaluate(lines: JsValue) -> Result<JsValue, JsValue> {
    let inputs: Vec<LineInputDto> = serde_wasm_bindgen::from_value(lines)
        .map_err(|error| JsValue::from_str(&error.to_string()))?;
    let inputs: Vec<InputLine> = inputs
        .into_iter()
        .map(|input| InputLine {
            id: input.id,
            text: input.text,
        })
        .collect();

    let results = evaluate_core(&inputs);
    let results: Vec<LineEvaluationDto> = results.into_iter().map(evaluation_dto).collect();

    serde_wasm_bindgen::to_value(&results).map_err(|error| JsValue::from_str(&error.to_string()))
}

/// Returns the engine version.
#[wasm_bindgen]
pub fn version() -> String {
    inlign_engine::version().to_owned()
}

fn evaluation_dto(evaluation: LineEvaluation) -> LineEvaluationDto {
    LineEvaluationDto {
        id: evaluation.id,
        status: status_dto(evaluation.status),
        suggestion: evaluation.suggestion.map(suggestion_dto),
        error: evaluation.error,
    }
}

fn status_dto(status: LineStatus) -> LineStatusDto {
    match status {
        LineStatus::Ok => LineStatusDto::Ok,
        LineStatus::Empty => LineStatusDto::Empty,
        LineStatus::Incomplete => LineStatusDto::Incomplete,
        LineStatus::Error => LineStatusDto::Error,
        LineStatus::Skipped => LineStatusDto::Skipped,
    }
}

fn suggestion_dto(suggestion: Suggestion) -> SuggestionDto {
    SuggestionDto {
        display: suggestion.display,
        insert: suggestion.insert,
    }
}
