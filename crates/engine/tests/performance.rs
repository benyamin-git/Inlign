use std::time::{Duration, Instant};

use inlign_engine::{InputLine, LineStatus, evaluate};

fn generated_lines(count: usize) -> Vec<InputLine> {
    assert_eq!(
        count, 500,
        "the representative dataset is fixed at 500 lines"
    );
    let mut lines = Vec::with_capacity(count);
    let mut push = |text: String| {
        let id = format!("l{}", lines.len());
        lines.push(InputLine { id, text });
    };

    for index in 0..100 {
        push(format!("v{index} = {index}"));
    }
    for index in 0..100 {
        push(format!("w{index} = v{index} + 1"));
    }
    for index in 0..100 {
        let next = (index + 1) % 100;
        let sum = (index + 1) + (next + 1);
        push(format!("w{index} + w{next} = {sum}"));
    }
    for index in 0..100 {
        push(format!("v{index} + 1 = w{index}"));
    }
    for index in 0..100 {
        push(format!("z{index} = "));
    }

    lines
}

#[test]
fn five_hundred_lines_finish_under_fifty_ms_in_release() {
    let lines = generated_lines(500);
    let start = Instant::now();
    let results = evaluate(&lines);
    let elapsed = start.elapsed();
    println!("500-line evaluation took {elapsed:?}");

    assert_eq!(results.len(), 500);
    // The generated notebook is valid and true end to end; an early error
    // would make the timing meaningless.
    assert!(
        !results
            .iter()
            .any(|result| result.status == LineStatus::Error)
    );
    assert_eq!(
        results
            .iter()
            .filter(|result| result.status == LineStatus::Incomplete)
            .count(),
        100
    );
    if !cfg!(debug_assertions) {
        assert!(
            elapsed < Duration::from_millis(50),
            "500-line evaluation took {elapsed:?}"
        );
    }
}
