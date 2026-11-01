import { useEffect, useState } from "react";

import { EngineClient } from "../engine/client.ts";

export default function App() {
  const [engineVersion, setEngineVersion] = useState<string | null>(null);

  useEffect(() => {
    const client = new EngineClient();
    let active = true;

    client.version().then(
      (version) => {
        if (active) {
          setEngineVersion(version);
        }
      },
      () => {
        // The engine is unreachable; the version stays empty.
      },
    );

    return () => {
      active = false;
      client.dispose();
    };
  }, []);

  return (
    <main>
      <h1>Inlign</h1>
      <span data-testid="engine-version">{engineVersion ?? ""}</span>
    </main>
  );
}
