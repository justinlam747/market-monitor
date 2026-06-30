import { Button, Input } from "@heroui/react";

export interface EditableCompetitor {
  id?: string;
  name: string;
}

const INPUT_CX = {
  inputWrapper:
    "border-1 border-default-300 bg-transparent shadow-none group-data-[focus=true]:border-default-foreground",
};

export function CompetitorInputList({
  competitors,
  onChange,
}: {
  competitors: EditableCompetitor[];
  onChange: (next: EditableCompetitor[]) => void;
}) {
  const update = (i: number, name: string) => {
    const next = competitors.slice();
    next[i] = { ...next[i], name };
    onChange(next);
  };
  const remove = (i: number) =>
    onChange(competitors.filter((_, idx) => idx !== i));
  const add = () => onChange([...competitors, { name: "" }]);

  return (
    <div className="flex flex-col gap-2">
      {competitors.map((c, i) => (
        <Input
          key={c.id ?? i}
          variant="bordered"
          value={c.name}
          placeholder="Competitor name"
          onValueChange={(v) => update(i, v)}
          classNames={INPUT_CX}
          endContent={
            <button
              type="button"
              aria-label="Remove"
              onClick={() => remove(i)}
              className="text-default-400 hover:text-default-600"
            >
              ✕
            </button>
          }
        />
      ))}
      <Button variant="flat" color="default" onPress={add}>
        + Add competitor
      </Button>
    </div>
  );
}
