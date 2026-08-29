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
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { BANKS, BANK_GROUPS } from '../utils/bankConfig';

function shouldShowShort(bank) {
  if (!bank.short) return false;
  if (bank.label.toLowerCase() === bank.short.toLowerCase()) return false;
  if (bank.label.includes(`(${bank.short})`)) return false;
  return true;
}

function BankTile({ bank, onSelect }) {
  const showShort = shouldShowShort(bank);

  return (
    <ButtonBase
      onClick={() => onSelect(bank.id)}
      aria-label={`Select ${bank.label}`}
      focusRipple
      sx={{
        width: '100%',
        textAlign: 'left',
        borderRadius: 1.5,
        border: '1px solid',
        borderColor: 'rgba(11, 61, 74, 0.12)',
        borderLeftWidth: 3,
        borderLeftColor: bank.accent,
        bgcolor: 'rgba(255,255,255,0.97)',
        px: 1.25,
        py: 1,
        gap: 1,
        display: 'flex',
        alignItems: 'center',
        minHeight: 52,
        boxShadow: '0 1px 2px rgba(11, 61, 74, 0.05)',
        transition:
          'border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease, background 160ms ease',
        '&:hover': {
          borderColor: `${bank.accent}66`,
          bgcolor: `${bank.accent}0A`,
          boxShadow: `0 6px 16px ${bank.accent}1A`,
          transform: 'translateY(-1px)',
          '& .bank-chevron': {
            opacity: 1,
            transform: 'translateX(2px)',
          },
        },
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'secondary.main',
          outlineOffset: 2,
        },
      }}
    >
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1,
          display: 'grid',
          placeItems: 'center',
          color: '#fff',
          background: `linear-gradient(145deg, ${bank.accent}, #0B3D4A)`,
          flexShrink: 0,
          boxShadow: `0 2px 6px ${bank.accent}40`,
        }}
      >
        <AccountBalanceRoundedIcon sx={{ fontSize: 17 }} />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: '0.82rem',
            fontWeight: 650,
            lineHeight: 1.3,
            color: 'text.primary',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {bank.label}
        </Typography>
        {showShort && (
          <Chip
            label={bank.short}
            size="small"
            sx={{
              mt: 0.4,
              height: 18,
              fontSize: '0.62rem',
              fontWeight: 700,
              bgcolor: `${bank.accent}14`,
              color: bank.accent,
              border: `1px solid ${bank.accent}33`,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        )}
      </Box>

      <ChevronRightRoundedIcon
        className="bank-chevron"
        sx={{
          fontSize: 18,
          color: 'text.secondary',
          opacity: 0.45,
          flexShrink: 0,
          transition: 'opacity 160ms ease, transform 160ms ease',
        }}
      />
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
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ sm: 'center' }}
        sx={{ mb: 1.75 }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: '0.9rem' }}>
            Select a format
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Bank statements, PF ECR, and other PDF exports
          </Typography>
        </Box>
        <TextField
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or abbreviation…"
          size="small"
          sx={{
            width: { xs: '100%', sm: 260 },
            flexShrink: 0,
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255,255,255,0.95)',
              borderRadius: 1.5,
              fontSize: '0.82rem',
            },
            '& .MuiOutlinedInput-input': {
              py: 0.85,
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon sx={{ fontSize: 17 }} color="action" />
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
            bgcolor: 'rgba(255,255,255,0.5)',
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
            sx={{ mb: groupIndex < filteredGroups.length - 1 ? 1.75 : 0 }}
          >
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{
                mb: 0.75,
                pb: 0.5,
                borderBottom: '1px solid rgba(11, 61, 74, 0.08)',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  letterSpacing: '0.08em',
                  fontWeight: 700,
                  fontSize: '0.68rem',
                  textTransform: 'uppercase',
                }}
              >
                {group.label}
              </Typography>
              <Chip
                label={group.banks.length}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  bgcolor: 'rgba(61,184,160,0.12)',
                  color: 'secondary.dark',
                }}
              />
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, 1fr)',
                  md: 'repeat(2, 1fr)',
                  lg: 'repeat(3, 1fr)',
                },
                gap: 1,
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
