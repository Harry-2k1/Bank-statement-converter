import { useState } from 'react';
import { Box, Container, Typography, Stack } from '@mui/material';
import BankSelector from './components/BankSelector';
import FileUpload from './components/FileUpload';
import { BANKS } from './utils/convertStatement';

const BANK_COUNT = Object.keys(BANKS).length;

export default function App() {
  const [bankId, setBankId] = useState(null);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background:
          'radial-gradient(900px 400px at 10% -5%, rgba(61,184,160,0.18), transparent 50%), linear-gradient(165deg, #F4FAF8 0%, #EAF3F1 100%)',
      }}
    >
      <Container
        maxWidth="md"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          px: { xs: 1.5, sm: 2 },
          py: { xs: 1.5, sm: 2 },
        }}
      >
        <Stack
          direction="row"
          alignItems="baseline"
          justifyContent="space-between"
          spacing={2}
          sx={{ mb: 1.5, flexShrink: 0 }}
        >
          <Box>
            <Typography
              component="h1"
              sx={{
                fontFamily: '"Source Serif 4", Georgia, serif',
                fontWeight: 600,
                fontSize: { xs: '1.25rem', sm: '1.4rem' },
                lineHeight: 1.2,
                color: 'primary.main',
                letterSpacing: '-0.02em',
              }}
            >
              Statement Converter
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.4 }}>
              PDF → Excel · {BANK_COUNT} banks · runs locally
            </Typography>
          </Box>
        </Stack>

        <Box
          sx={{
            flex: 1,
            p: { xs: 1.5, sm: 2 },
            borderRadius: 2,
            border: '1px solid rgba(11, 61, 74, 0.1)',
            bgcolor: 'rgba(255,255,255,0.88)',
            boxShadow: '0 4px 20px rgba(11, 61, 74, 0.06)',
          }}
        >
          {bankId ? (
            <FileUpload bankId={bankId} onBack={() => setBankId(null)} />
          ) : (
            <BankSelector onSelect={setBankId} />
          )}
        </Box>
      </Container>

      <Typography
        component="footer"
        variant="caption"
        color="text.secondary"
        sx={{
          py: 1,
          px: 2,
          textAlign: 'center',
          borderTop: '1px solid rgba(11, 61, 74, 0.06)',
          flexShrink: 0,
        }}
      >
        Processing stays in your browser — pick the bank format that matches your PDF.
      </Typography>
    </Box>
  );
}
