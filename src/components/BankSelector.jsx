import { useMemo, useState } from 'react';
import {
  Box,
  Stack,
  Typography,
  ButtonBase,
  TextField,
  InputAdornment,
} from '@mui/material';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { BANKS, BANK_GROUPS } from '../utils/convertStatement';

function BankTile({ bank, onSelect }) {
  return (
    <ButtonBase
      onClick={() => onSelect(bank.id)}
      title={bank.label}
      focusRipple
      sx={{
        width: '100%',
        textAlign: 'left',
        borderRadius: 1.25,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'rgba(255,255,255,0.95)',
        px: 1,
        py: 0.75,
        gap: 0.75,
        display: 'flex',
        alignItems: 'center',
        minHeight: 36,
        transition: 'border-color 150ms ease, background 150ms ease',
        '&:hover': {
          borderColor: 'secondary.main',
          bgcolor: 'rgba(61,184,160,0.08)',
        },
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'secondary.main',
          outlineOffset: 1,
        },
      }}
    >
      <Box
        sx={{
          width: 24,
          height: 24,
          borderRadius: 0.75,
          display: 'grid',
          placeItems: 'center',
          color: '#fff',
          background: `linear-gradient(145deg, ${bank.accent}, #0B3D4A)`,
          flexShrink: 0,
        }}
      >
        <AccountBalanceRoundedIcon sx={{ fontSize: 14 }} />
      </Box>
      <Typography
        noWrap
        sx={{
          flex: 1,
          minWidth: 0,
          fontSize: '0.78rem',
          fontWeight: 600,
          lineHeight: 1.2,
          color: 'text.primary',
        }}
      >
        {bank.short}
      </Typography>
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
        direction="row"
        spacing={1.5}
        alignItems="center"
        sx={{ mb: 1.5 }}
      >
        <Typography
          variant="subtitle2"
          sx={{ fontWeight: 700, flexShrink: 0, fontSize: '0.85rem' }}
        >
          Select bank
        </Typography>
        <TextField
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          size="small"
          sx={{
            flex: 1,
            maxWidth: 220,
            ml: 'auto',
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255,255,255,0.9)',
              borderRadius: 1.25,
              fontSize: '0.8rem',
            },
            '& .MuiOutlinedInput-input': {
              py: 0.75,
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ fontSize: 16 }} color="action" />
              </InputAdornment>
            ),
          }}
        />
      </Stack>

      {totalVisible === 0 ? (
        <Box
          sx={{
            py: 3,
            px: 2,
            textAlign: 'center',
            borderRadius: 1.5,
            border: '1px dashed',
            borderColor: 'divider',
          }}
        >
          <Typography variant="body2" color="text.secondary">
            No banks match &ldquo;{query}&rdquo;
          </Typography>
        </Box>
      ) : (
        filteredGroups.map((group, groupIndex) => (
          <Box
            key={group.id}
            sx={{ mb: groupIndex < filteredGroups.length - 1 ? 1.25 : 0 }}
          >
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                mb: 0.5,
                color: 'text.secondary',
                letterSpacing: '0.06em',
                fontWeight: 700,
                fontSize: '0.65rem',
                textTransform: 'uppercase',
              }}
            >
              {group.label}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, 1fr)',
                  sm: 'repeat(3, 1fr)',
                  md: 'repeat(4, 1fr)',
                  lg: 'repeat(5, 1fr)',
                },
                gap: 0.75,
              }}
            >
              {group.banks.map((bank) => (
                <BankTile key={bank.id} bank={bank} onSelect={onSelect} />
              ))}
            </Box>
          </Box>
        ))
      )}
    </Box>
  );
}
