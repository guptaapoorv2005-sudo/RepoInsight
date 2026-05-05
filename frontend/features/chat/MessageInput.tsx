import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

type MessageInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isSending: boolean;
  disabled: boolean;
  placeholder?: string;
};

export function MessageInput({
  value,
  onChange,
  onSend,
  isSending,
  disabled,
  placeholder
}: MessageInputProps) {
  useEffect(() => {
    if (!disabled) return;
    onChange("");
  }, [disabled, onChange]);

  return (
    <div className="flex items-end gap-3 rounded-xl border border-border bg-surface p-3 shadow-sm">
      <Textarea
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (!disabled && value.trim()) {
              onSend();
            }
          }
        }}
        disabled={disabled}
        rows={2}
      />
      <Button
        onClick={onSend}
        disabled={disabled || !value.trim()}
        isLoading={isSending}
        className="shrink-0"
      >
        Send
      </Button>
    </div>
  );
}
