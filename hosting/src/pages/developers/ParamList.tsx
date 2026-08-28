import {
  Accordion, AccordionDetails, AccordionSummary, Chip, Stack, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

/** Renders the subset of parameters a given endpoint accepts. */
export default function ParamList({
  names,
  docs,
  required = [],
}: {
  names: string[];
  docs: Record<string, string>;
  required?: string[];
}) {
  return (
    <Stack spacing={1.5}>
      {names.map((name) => (
        <Accordion key={name} disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography component="span"><code>{name}</code></Typography>
            {required.includes(name) && (
              <Chip label="required" size="small" color="primary" variant="outlined" sx={{ ml: 1.5 }} />
            )}
          </AccordionSummary>
          <AccordionDetails>
            <Typography color="text.secondary">{docs[name]}</Typography>
          </AccordionDetails>
        </Accordion>
      ))}
    </Stack>
  );
}
