import React, { useCallback } from "react";
import { Agentation, type Annotation } from "agentation";

import { generatePlaywrightScript } from "./generation-client";
import { saveScriptAsPythonFile } from "./script-download";
import { RUNTIME_CONFIG } from "../shared/runtime-config";

export function AgentationExtensionApp(): JSX.Element {
  const onGenerateScript = useCallback(
    async (output: string, annotations: Annotation[]) => {
      if (annotations.length === 0) {
        return;
      }

      try {
        const result = await generatePlaywrightScript({
          pageUrl: window.location.href,
          markdown: output,
          annotations,
        });

        const savedFile = await saveScriptAsPythonFile(
          result.script,
          result.testName,
        );
        let copiedToClipboard = false;
        try {
          await navigator.clipboard.writeText(result.script);
          copiedToClipboard = true;
        } catch (clipboardError) {
          console.warn(
            "[Agentation Extension] Clipboard write failed; script was still downloaded:",
            clipboardError,
          );
        }
        const assetLabel = result.metadata.asset
          ? `, case=${result.metadata.asset.caseId}, version=${result.metadata.asset.versionNo}`
          : "";
        console.info(
          `[Agentation Extension] Generated ${result.testName}, ${
            copiedToClipboard ? "copied to clipboard, " : ""
          }saved as ${savedFile}${assetLabel}`,
        );
      } catch (generationError) {
        console.warn(
          "[Agentation Extension] Script generation failed:",
          generationError,
        );
        throw generationError;
      }
    },
    [],
  );

  return (
    <Agentation
      endpoint={RUNTIME_CONFIG.mcpEndpoint}
      onGenerateScript={onGenerateScript}
    />
  );
}
