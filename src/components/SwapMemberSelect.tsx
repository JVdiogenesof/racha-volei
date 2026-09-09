"use client";

import { ActionForm } from "./ActionForm";

export function SwapMemberSelect({
  action,
  eventId,
  teamMemberId,
  otherMembers,
}: {
  action: (formData: FormData) => void;
  eventId: string;
  teamMemberId: string;
  otherMembers: { teamMemberId: string; fullName: string; teamNumber: number }[];
}) {
  return (
    <ActionForm action={action} successMessage="Jogadores trocados de time!">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="teamMemberId" value={teamMemberId} />
      <select
        name="swapWithTeamMemberId"
        defaultValue=""
        onChange={(e) => {
          if (e.currentTarget.value) e.currentTarget.form?.requestSubmit();
        }}
        className="rounded border border-gray-300 text-xs text-gray-500"
      >
        <option value="" disabled>
          Trocar com...
        </option>
        {otherMembers.map((m) => (
          <option key={m.teamMemberId} value={m.teamMemberId}>
            {m.fullName} (Time {m.teamNumber})
          </option>
        ))}
      </select>
    </ActionForm>
  );
}
