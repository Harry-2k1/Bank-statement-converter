import { Box, Stack, Typography, ButtonBase } from '@mui/material';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import { BANKS } from '../utils/convertStatement';

function BankCard({ bank, onSelect }) {
  return (
    <ButtonBase
      onClick={() => onSelect(bank.id)}
      focusRipple
      sx={{
        width: '100%',
        textAlign: 'left',
        borderRadius: 3,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        background:
          'linear-gradient(160deg, rgba(255,255,255,0.96) 0%, rgba(232,244,242,0.9) 100%)',
        transition: 'transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease',
        '@keyframes riseIn': {
          from: { opacity: 0, transform: 'translateY(16px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        animation: 'riseIn 480ms ease both',
        '&:hover': {
          transform: 'translateY(-4px)',
          borderColor: 'secondary.main',
          boxShadow: '0 16px 40px rgba(11, 61, 74, 0.12)',
        },
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'secondary.main',
          outlineOffset: 2,
        },
      }}
    >
      <Stack spacing={2} sx={{ p: { xs: 2.5, md: 3.25 }, width: '100%' }}>
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            background: `linear-gradient(145deg, ${bank.accent}, #0B3D4A)`,
          }}
        >
          <AccountBalanceRoundedIcon />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ mb: 0.75, fontSize: { xs: '1.35rem', md: '1.6rem' } }}>
            {bank.label}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320 }}>
            {bank.description}
          </Typography>
        </Box>
        <Typography
          variant="body2"
          sx={{ color: 'secondary.dark', fontWeight: 600, letterSpacing: '0.02em' }}
        >
          Continue →
        </Typography>
      </Stack>
    </ButtonBase>
  );
}

export default function BankSelector({ onSelect }) {
  return (
    <Box>
      <Typography
        variant="h4"
        sx={{
          mb: 1,
          fontSize: { xs: '1.75rem', md: '2.25rem' },
          '@keyframes fadeUp': {
            from: { opacity: 0, transform: 'translateY(10px)' },
            to: { opacity: 1, transform: 'translateY(0)' },
          },
          animation: 'fadeUp 420ms ease both',
        }}
      >
        Choose your bank
      </Typography>
      <Typography
        color="text.secondary"
        sx={{ mb: 3.5, maxWidth: 480, animation: 'fadeUp 420ms ease 80ms both' }}
      >
        Select the statement type, then upload the PDF to download a clean Excel file.
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
          gap: 2.5,
        }}
      >
        <BankCard bank={BANKS.hdfc} onSelect={onSelect} />
        <BankCard bank={BANKS.indian} onSelect={onSelect} />
        <BankCard bank={BANKS.kvb} onSelect={onSelect} />
      </Box>
    </Box>
  );
}
