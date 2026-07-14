import { useMemo, useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  ButtonBase,
  TextField,
  InputAdornment,
  Chip,
} from '@mui/material';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { BANKS, BANK_GROUPS } from '../utils/convertStatement';

function BankCard({ bank, onSelect, index }) {
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
          'linear-gradient(160deg, rgba(255,255,255,0.98) 0%, rgba(232,244,242,0.88) 100%)',
        transition: 'transform 220ms ease, border-color 220ms ease, box-shadow 220ms ease',
        '@keyframes riseIn': {
          from: { opacity: 0, transform: 'translateY(16px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        animation: `riseIn 480ms ease ${Math.min(index * 40, 320)}ms both`,
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
      <Stack spacing={2} sx={{ p: { xs: 2.25, sm: 2.75, md: 3 }, width: '100%' }}>
        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              background: `linear-gradient(145deg, ${bank.accent}, #0B3D4A)`,
              flexShrink: 0,
            }}
          >
            <AccountBalanceRoundedIcon />
          </Box>
          <Chip
            label={bank.short}
            size="small"
            sx={{
              bgcolor: `${bank.accent}18`,
              color: bank.accent,
              fontWeight: 700,
              border: `1px solid ${bank.accent}33`,
            }}
          />
        </Stack>
        <Box>
          <Typography
            variant="h6"
            sx={{ mb: 0.5, fontSize: { xs: '1.15rem', md: '1.3rem' }, lineHeight: 1.25 }}
          >
            {bank.label}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
            {bank.description}
          </Typography>
        </Box>
        <Typography
          variant="body2"
          sx={{ color: 'secondary.dark', fontWeight: 600, letterSpacing: '0.02em' }}
        >
          Select →
        </Typography>
      </Stack>
    </ButtonBase>
  );
}

export default function BankSelector({ onSelect }) {
  const [query, setQuery] = useState('');

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return BANK_GROUPS.map((group) => ({
      ...group,
      banks: Object.values(BANKS).filter((bank) => {
        if (bank.group !== group.id) return false;
        if (!q) return true;
        return (
          bank.label.toLowerCase().includes(q) ||
          bank.short.toLowerCase().includes(q) ||
          bank.description.toLowerCase().includes(q)
        );
      }),
    })).filter((group) => group.banks.length > 0);
  }, [query]);

  const totalVisible = filteredGroups.reduce((sum, g) => sum + g.banks.length, 0);

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={{ xs: 2, md: 3 }}
        sx={{ mb: 3.5, alignItems: { md: 'flex-end' }, justifyContent: 'space-between' }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="h4"
            sx={{
              mb: 1,
              fontSize: { xs: '1.65rem', sm: '1.9rem', md: '2.15rem' },
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
            sx={{ maxWidth: 560, animation: 'fadeUp 420ms ease 80ms both', lineHeight: 1.6 }}
          >
            Pick the statement format that matches your PDF, then upload to download a clean Excel
            file with a summary sheet.
          </Typography>
        </Box>

        <TextField
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search banks…"
          size="small"
          sx={{
            width: { xs: '100%', md: 280, lg: 320 },
            flexShrink: 0,
            animation: 'fadeUp 420ms ease 120ms both',
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255,255,255,0.85)',
              borderRadius: 2.5,
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          }}
        />
      </Stack>

      {totalVisible === 0 ? (
        <Box
          sx={{
            py: 6,
            px: 3,
            textAlign: 'center',
            borderRadius: 3,
            border: '1px dashed',
            borderColor: 'divider',
            bgcolor: 'rgba(255,255,255,0.55)',
          }}
        >
          <Typography color="text.secondary">No banks match &ldquo;{query}&rdquo;</Typography>
        </Box>
      ) : (
        filteredGroups.map((group, groupIndex) => (
          <Box key={group.id} sx={{ mb: groupIndex < filteredGroups.length - 1 ? 4 : 0 }}>
            <Typography
              variant="overline"
              sx={{
                display: 'block',
                mb: 1.75,
                color: 'text.secondary',
                letterSpacing: '0.12em',
                fontWeight: 700,
              }}
            >
              {group.label}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)',
                  lg: 'repeat(3, 1fr)',
                  xl: 'repeat(3, 1fr)',
                },
                gap: { xs: 2, sm: 2.25, lg: 2.5 },
              }}
            >
              {group.banks.map((bank, index) => (
                <BankCard key={bank.id} bank={bank} onSelect={onSelect} index={index} />
              ))}
            </Box>
          </Box>
        ))
      )}
    </Box>
  );
}
