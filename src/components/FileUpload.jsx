import { useCallback, useRef, useState } from 'react';
import {
  Box,
  Button,
  Stack,
  Typography,
  LinearProgress,
  Alert,
  Chip,
} from '@mui/material';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import { BANKS, convertStatementPdf } from '../utils/convertStatement';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function FileUpload({ bankId, onBack }) {
  const bank = BANKS[bankId];
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const acceptFile = useCallback((next) => {
    setError('');
    setResult(null);
    if (!next) return;
    if (next.type !== 'application/pdf' && !next.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF bank statement.');
      setFile(null);
      return;
    }
    setFile(next);
  }, []);

  const onDrop = (event) => {
    event.preventDefault();
    setDragOver(false);
    const dropped = event.dataTransfer.files?.[0];
    acceptFile(dropped);
  };

  const handleConvert = async () => {
    if (!file) {
      setError('Select a PDF statement first.');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const converted = await convertStatementPdf(file, bankId);
      setResult(converted);
    } catch (err) {
      setError(err?.message || 'Conversion failed. Please try another file.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        '@keyframes fadeUp': {
          from: { opacity: 0, transform: 'translateY(12px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        animation: 'fadeUp 420ms ease both',
      }}
    >
      <Button
        startIcon={<ArrowBackRoundedIcon />}
        onClick={onBack}
        sx={{ mb: 2.5, color: 'text.secondary' }}
      >
        Back to banks
      </Button>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{
          mb: 3,
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontSize: { xs: '1.7rem', md: '2.1rem' } }}>
            Upload {bank.label} statement
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75 }}>
            Drop your PDF here or browse a file. Excel downloads automatically after conversion.
          </Typography>
        </Box>
        <Chip
          label={bank.short}
          sx={{
            bgcolor: bank.accent,
            color: '#fff',
            fontWeight: 600,
            height: 32,
          }}
        />
      </Stack>

      <Box
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        sx={{
          borderRadius: 3,
          border: '1.5px dashed',
          borderColor: dragOver ? 'secondary.main' : 'rgba(11, 61, 74, 0.28)',
          background: dragOver
            ? 'linear-gradient(180deg, rgba(61,184,160,0.14), rgba(255,255,255,0.9))'
            : 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(234,243,241,0.75))',
          px: { xs: 2.5, md: 4 },
          py: { xs: 4, md: 5.5 },
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'border-color 180ms ease, background 180ms ease, transform 180ms ease',
          transform: dragOver ? 'scale(1.01)' : 'none',
          mb: 2.5,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => acceptFile(e.target.files?.[0])}
        />
        <Box
          sx={{
            width: 72,
            height: 72,
            mx: 'auto',
            mb: 2,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            color: 'primary.main',
            background: 'rgba(61, 184, 160, 0.16)',
            '@keyframes floatIcon': {
              '0%, 100%': { transform: 'translateY(0)' },
              '50%': { transform: 'translateY(-5px)' },
            },
            animation: 'floatIcon 2.8s ease-in-out infinite',
          }}
        >
          <CloudUploadRoundedIcon sx={{ fontSize: 36 }} />
        </Box>
        <Typography variant="h6" sx={{ mb: 0.75 }}>
          Drag & drop PDF statement
        </Typography>
        <Typography color="text.secondary" variant="body2">
          or click to browse from your device
        </Typography>
      </Box>

      {file && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{
            p: 2,
            mb: 2.5,
            borderRadius: 2.5,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'rgba(255,255,255,0.8)',
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', sm: 'center' },
          }}
        >
          <Stack direction="row" spacing={1.5} sx={{ minWidth: 0, alignItems: 'center' }}>
            <PictureAsPdfRoundedIcon color="error" />
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap fontWeight={600}>
                {file.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatBytes(file.size)}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              color="inherit"
              onClick={(e) => {
                e.stopPropagation();
                setFile(null);
                setResult(null);
                setError('');
                if (inputRef.current) inputRef.current.value = '';
              }}
            >
              Remove
            </Button>
            <Button
              variant="contained"
              startIcon={<DownloadRoundedIcon />}
              onClick={handleConvert}
              disabled={loading}
            >
              {loading ? 'Converting…' : 'Convert to Excel'}
            </Button>
          </Stack>
        </Stack>
      )}

      {loading && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress color="secondary" />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Reading PDF pages and building Excel…
          </Typography>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {result && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Converted {result.count} transactions from {result.bankLabel}. Your Excel file has been
          downloaded.
        </Alert>
      )}
    </Box>
  );
}
