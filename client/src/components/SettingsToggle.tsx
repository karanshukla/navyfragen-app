import { Loader, Switch } from "@mantine/core";

interface SettingsToggleProps {
  /** Accessible name. The card title is the visible label, so the switch has none. */
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Swaps the thumb for a spinner while this change is in flight. */
  saving?: boolean;
}

const SPINNER = <Loader size={12} color="var(--mantine-color-body)" />;

/**
 * The on/off control in a `SettingsCard` header. Every binary setting in the app
 * uses it, so state is always read off a track rather than off a button label.
 */
export function SettingsToggle({
  label,
  checked,
  onChange,
  disabled,
  saving,
}: SettingsToggleProps) {
  return (
    <Switch
      aria-label={label}
      checked={checked}
      onChange={(event) => onChange(event.currentTarget.checked)}
      disabled={disabled || saving}
      thumbIcon={saving ? SPINNER : undefined}
      size="md"
    />
  );
}
