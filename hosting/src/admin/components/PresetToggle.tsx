import { useState } from 'react';
import { Box, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import PaletteIcon from '@mui/icons-material/Palette';
import CheckIcon from '@mui/icons-material/Check';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { PRESET_LIST, type PresetId } from '../../theme/presets';
import { getPresetId, setPresetId } from '../../theme/presetStore';
import { usePresetId } from '../../theme/usePresetId';

/**
 * Per-user theme picker.
 *
 * Applied locally first so the change is instant, then persisted. A failed
 * write reverts rather than leaving the UI disagreeing with what is stored.
 */
export default function PresetToggle() {
  const presetId = usePresetId();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const choose = async (id: PresetId) => {
    setAnchor(null);
    const previous = getPresetId();
    if (id === previous) return;

    setPresetId(id);

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    try {
      await setDoc(doc(db, 'user_prefs', uid), { theme_preset: id }, { merge: true });
    } catch {
      setPresetId(previous);
    }
  };

  return (
    <>
      <Tooltip title="Theme">
        <IconButton onClick={(e) => setAnchor(e.currentTarget)} color="inherit" sx={{ width: 40, height: 40 }}>
          <PaletteIcon />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {PRESET_LIST.map((p) => (
          <MenuItem key={p.id} onClick={() => choose(p.id)} selected={p.id === presetId}>
            <ListItemIcon>
              {p.id === presetId ? (
                <CheckIcon fontSize="small" />
              ) : (
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    bgcolor: p.swatch,
                    border: '1px solid',
                    borderColor: 'divider',
                  }}
                />
              )}
            </ListItemIcon>
            <ListItemText>{p.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
