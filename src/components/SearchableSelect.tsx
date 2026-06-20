import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  disabled?: boolean;
  optionHints?: Record<string, string>;
};

function OptionLabel({ option, hint }: { option: string; hint?: string }) {
  if (!hint) {
    return (
      <span className="whitespace-normal break-words text-left text-xs leading-snug">{option}</span>
    );
  }
  return (
    <span className="flex min-w-0 flex-col items-start gap-0 text-left leading-tight">
      <span className="whitespace-normal break-words text-xs leading-snug">{option}</span>
      <span className="text-[9px] font-normal text-muted-foreground">({hint})</span>
    </span>
  );
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  disabled,
  optionHints,
}: Props) {
  const [open, setOpen] = useState(false);
  const selectedHint = value ? optionHints?.[value] : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-auto min-h-8 w-full justify-between px-2 py-1 text-xs font-normal",
            selectedHint && "items-center",
          )}
        >
          <span className="min-w-0 flex-1 text-left">
            {value ? (
              <OptionLabel option={value} hint={selectedHint} />
            ) : (
              <span className="text-xs text-muted-foreground">{placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-1 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command className="text-xs">
          <CommandInput placeholder={searchPlaceholder} className="h-8 text-xs" />
          <CommandList className="max-h-52">
            <CommandEmpty className="py-3 text-xs">{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const hint = optionHints?.[option];
                return (
                  <CommandItem
                    key={option}
                    value={hint ? `${option} ${hint}` : option}
                    className="items-start py-1.5 text-xs"
                    onSelect={() => {
                      onValueChange(option);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-1.5 mt-0.5 size-3 shrink-0",
                        value === option ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <OptionLabel option={option} hint={hint} />
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
