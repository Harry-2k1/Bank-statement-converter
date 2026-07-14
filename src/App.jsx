import { useState } from 'react';
import { Box, Container, Typography } from '@mui/material';
import BankSelector from './components/BankSelector';
import FileUpload from './components/FileUpload';

export default function App() {
  const [bankId, setBankId] = useState(null);

  return (
    <Box
      sx={{
        minHeight: '100vh',
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
      <Container maxWidth="md" sx={{ position: 'relative', py: { xs: 4, md: 7 } }}>
        <Box sx={{ mb: { xs: 4, md: 5.5 } }}>
          <Typography
            component="p"
            sx={{
              fontFamily: '"Source Serif 4", Georgia, serif',
              fontWeight: 600,
              fontSize: { xs: '2.4rem', md: '3.4rem' },
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
              maxWidth: 460,
              fontSize: { xs: '1rem', md: '1.05rem' },
              animation: 'brandIn 500ms ease 90ms both',
            }}
          >
            Turn bank statement PDFs into tidy Excel sheets in a few clicks.
          </Typography>
        </Box>

        <Box
          sx={{
            p: { xs: 2.5, md: 4 },
            borderRadius: 4,
            border: '1px solid rgba(11, 61, 74, 0.1)',
            bgcolor: 'rgba(255,255,255,0.72)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 24px 60px rgba(11, 61, 74, 0.08)',
          }}
        >
          {bankId ? (
            <FileUpload bankId={bankId} onBack={() => setBankId(null)} />
          ) : (
            <BankSelector onSelect={setBankId} />
          )}
        </Box>
      </Container>
    </Box>
  );
}
