import React from "react";
import { Text, Box } from "ink";

interface ProgressBarProps {
  current: number;
  total: number;
  width?: number;
  label?: string;
}

export function ProgressBar({ current, total, width = 30, label }: ProgressBarProps) {
  const percentage = total > 0 ? Math.min(current / total, 1) : 0;
  const filled = Math.round(percentage * width);
  const empty = width - filled;

  const percentDisplay = Math.round(percentage * 100);

  return (
    <Box>
      {label && <Text>{label} </Text>}
      <Text color="green">{"█".repeat(filled)}</Text>
      <Text color="gray">{"░".repeat(empty)}</Text>
      <Text> {percentDisplay}%</Text>
    </Box>
  );
}
