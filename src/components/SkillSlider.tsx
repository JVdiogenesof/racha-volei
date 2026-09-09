"use client";

import { useState } from "react";

export function SkillSlider({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: number;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <label htmlFor={name} className="font-medium text-brand-navy">
          {label}
        </label>
        <span className="font-semibold text-brand-purple">{value.toFixed(1)}</span>
      </div>
      <input
        id={name}
        name={name}
        type="range"
        min={0}
        max={5}
        step={0.5}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="mt-1 w-full accent-brand-purple"
      />
    </div>
  );
}
