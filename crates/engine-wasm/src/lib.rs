//! Thin `#[wasm_bindgen]` facade over `inlign-engine`.

use wasm_bindgen::prelude::*;

/// Returns the engine version.
#[wasm_bindgen]
pub fn version() -> String {
    inlign_engine::version().to_owned()
}
