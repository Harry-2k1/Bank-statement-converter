import { useState } from 'react';
import { Box, Container, Typography, Stack, Chip } from '@mui/material';
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
        position: 'relative',
        overflow: 'hidden',
        background:
          'radial-gradient(1200px 600px at 10% -10%, rgba(61,184,160,0.28), transparent 55%), radial-gradient(900px 500px at 90% 0%, rgba(11,61,74,0.18), transparent 50%), linear-gradient(165deg, #F4FAF8 0%, #EAF3F1 45%, #DCECE8 100%)',
        '&::before': {
          content: '""',
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(11,61,74,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(11,61,74,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 35%, transparent 80%)',
          pointerEvents: 'none',
        },
      }}
    >
      <Container
        maxWidth={false}
        sx={{
          position: 'relative',
          flex: 1,
          width: '100%',
          maxWidth: { xs: '100%', sm: 640, md: 960, lg: 1200, xl: 1440 },
          px: { xs: 2, sm: 3, md: 4, xl: 5 },
          py: { xs: 3, sm: 4, md: 6, xl: 7 },
        }}
      >
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={{ xs: 3, lg: 5, xl: 6 }}
          sx={{ alignItems: { lg: 'flex-start' } }}
        >
          <Box
            sx={{
              flex: { lg: '0 0 320px', xl: '0 0 360px' },
              position: { lg: 'sticky' },
              top: { lg: 32 },
              pt: { xs: 0.5, md: 1 },
            }}
          >
            <Typography
              component="p"
              sx={{
                fontFamily: '"Source Serif 4", Georgia, serif',
                fontWeight: 600,
                fontSize: { xs: '2.2rem', sm: '2.6rem', md: '3rem', xl: '3.35rem' },
                lineHeight: 1.05,
                color: 'primary.main',
                letterSpacing: '-0.03em',
                mb: 1.25,
                '@keyframes brandIn': {
                  from: { opacity: 0, transform: 'translateY(14px)' },
                  to: { opacity: 1, transform: 'translateY(0)' },
                },
                animation: 'brandIn 500ms ease both',
              }}
            >
              Statement Converter
            </Typography>
            <Typography
              color="text.secondary"
              sx={{
                maxWidth: 420,
                fontSize: { xs: '0.98rem', md: '1.05rem' },
                lineHeight: 1.65,
                mb: 2.5,
                animation: 'brandIn 500ms ease 90ms both',
              }}
            >
              Turn bank statement PDFs into tidy Excel sheets. Works in your browser — no upload to
              a server.
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ animation: 'brandIn 500ms ease 140ms both' }}>
              <Chip
                label={`${BANK_COUNT} banks supported`}
                size="small"
                sx={{ bgcolor: 'rgba(61,184,160,0.16)', fontWeight: 600 }}
              />
              <Chip
                label="PDF → Excel"
                size="small"
                variant="outlined"
                sx={{ borderColor: 'divider', fontWeight: 600 }}
              />
            </Stack>
          </Box>

          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              p: { xs: 2, sm: 2.75, md: 3.5, xl: 4 },
              borderRadius: { xs: 3, md: 4 },
              border: '1px solid rgba(11, 61, 74, 0.1)',
              bgcolor: 'rgba(255,255,255,0.78)',
              backdropFilter: 'blur(12px)',
              boxShadow: {
                xs: '0 16px 40px rgba(11, 61, 74, 0.07)',
                lg: '0 24px 60px rgba(11, 61, 74, 0.09)',
              },
            }}
          >
            {bankId ? (
              <FileUpload bankId={bankId} onBack={() => setBankId(null)} />
            ) : (
              <BankSelector onSelect={setBankId} />
            )}
          </Box>
        </Stack>
      </Container>

      <Box
        component="footer"
        sx={{
          position: 'relative',
          py: 2.5,
          px: 2,
          textAlign: 'center',
          borderTop: '1px solid rgba(11, 61, 74, 0.08)',
          bgcolor: 'rgba(255,255,255,0.45)',
        }}
      >
        <Typography variant="caption" color="text.secondary">
          Processing happens locally in your browser. Use the bank format that matches your PDF
          export.
        </Typography>
      </Box>
    </Box>
  );
}
