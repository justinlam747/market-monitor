import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  CardBody,
  Input,
  Radio,
  RadioGroup,
} from "@heroui/react";
import type { RunMode } from "@shared/types";
import { createRun } from "../api.js";

// Single clean border, no shadow / inner ring.
const INPUT_CX = {
  inputWrapper:
    "border-1 border-default-300 bg-transparent shadow-none group-data-[focus=true]:border-default-foreground",
};

export function AnalyzeForm() {
  const navigate = useNavigate();
  const [companyUrl, setCompanyUrl] = useState("");
  const [mode, setMode] = useState<RunMode>("autonomous");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const { runId } = await createRun({
        companyUrl: companyUrl.trim(),
        mode,
      });
      navigate(`/run/${runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start run");
      setSubmitting(false);
    }
  };

  return (
    <Card shadow="sm">
      <CardBody className="gap-5 p-6">
        <Input
          isRequired
          type="url"
          label="Company URL"
          labelPlacement="outside"
          placeholder="https://yourstartup.com"
          variant="bordered"
          value={companyUrl}
          onValueChange={setCompanyUrl}
          classNames={INPUT_CX}
        />

        <RadioGroup
          label="Run mode"
          value={mode}
          onValueChange={(v) => setMode(v as RunMode)}
        >
          <Radio
            value="autonomous"
            color="default"
            description="Fastest. The agent runs end-to-end and streams its progress live."
          >
            Autonomous
          </Radio>
          <Radio
            value="review"
            color="default"
            description="Same analysis as autonomous, but pauses at each checkpoint so you can shape identity, competitors, sources, claims, and gaps."
          >
            Review checkpoints
          </Radio>
        </RadioGroup>

        {error && <p className="text-sm text-default-600">{error}</p>}

        <Button
          color="primary"
          variant="solid"
          isLoading={submitting}
          onPress={submit}
          className="self-start"
        >
          Analyze competitors
        </Button>
      </CardBody>
    </Card>
  );
}
