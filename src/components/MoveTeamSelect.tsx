"use client";

export function MoveTeamSelect({
  action,
  eventId,
  teamMemberId,
  currentTeamId,
  teams,
}: {
  action: (formData: FormData) => void;
  eventId: string;
  teamMemberId: string;
  currentTeamId: string;
  teams: { id: string; teamNumber: number }[];
}) {
  return (
    <form action={action}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="teamMemberId" value={teamMemberId} />
      <select
        name="targetTeamId"
        defaultValue={currentTeamId}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded border border-gray-300 text-xs"
      >
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            Time {t.teamNumber}
          </option>
        ))}
      </select>
    </form>
  );
}
