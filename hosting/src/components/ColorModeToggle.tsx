import { useColorScheme } from '@mui/material/styles';
import { IconButton, Tooltip } from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';

const NEXT = { system: 'light', light: 'dark', dark: 'system' } as const;
const LABEL = { system: 'System theme', light: 'Light theme', dark: 'Dark theme' } as const;

export default function ColorModeToggle() {
  const { mode, setMode } = useColorScheme();

  // `mode` is undefined until MUI resolves the stored scheme, so rendering an
  // icon straight away flashes the wrong one. Reserve the space instead.
  if (!mode) {
    return <IconButton disabled sx={{ width: 40, height: 40 }} aria-hidden />;
  }

  const icon =
    mode === 'light' ? <LightModeIcon /> : mode === 'dark' ? <DarkModeIcon /> : <SettingsBrightnessIcon />;

  return (
    <Tooltip title={`${LABEL[mode]} — click to change`}>
      <IconButton
        onClick={() => setMode(NEXT[mode])}
        color="inherit"
        aria-label={`Switch theme. Current: ${LABEL[mode]}`}
        sx={{ width: 40, height: 40 }}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );
}
