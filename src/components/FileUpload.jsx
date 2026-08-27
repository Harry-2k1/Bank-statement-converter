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
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Button
          size="small"
          startIcon={<ArrowBackRoundedIcon sx={{ fontSize: 16 }} />}
          onClick={onBack}
          sx={{ color: 'text.secondary', minHeight: 32, py: 0.5, px: 1 }}
        >
          Back
        </Button>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1, fontSize: '0.85rem' }}>
          {bank.label}
        </Typography>
        <Chip
          label={bank.short}
          size="small"
          sx={{
            bgcolor: bank.accent,
            color: '#fff',
            fontWeight: 600,
            height: 22,
            fontSize: '0.7rem',
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
          borderRadius: 1.5,
          border: '1px dashed',
          borderColor: dragOver ? 'secondary.main' : 'rgba(11, 61, 74, 0.22)',
          background: dragOver
            ? 'rgba(61,184,160,0.1)'
            : 'rgba(255,255,255,0.7)',
          px: 2,
          py: 2.5,
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'border-color 150ms ease, background 150ms ease',
          mb: 1.5,
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => acceptFile(e.target.files?.[0])}
        />
        <CloudUploadRoundedIcon
          sx={{ fontSize: 28, color: 'secondary.main', mb: 0.5 }}
        />
        <Typography variant="body2" fontWeight={600} sx={{ mb: 0.25 }}>
          Drop PDF or click to browse
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Excel downloads automatically after conversion
        </Typography>
      </Box>

      {file && (
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          sx={{
            p: 1.25,
            mb: 1.5,
            borderRadius: 1.25,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'rgba(255,255,255,0.8)',
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', sm: 'center' },
          }}
        >
          <Stack direction="row" spacing={1} sx={{ minWidth: 0, alignItems: 'center' }}>
            <PictureAsPdfRoundedIcon color="error" sx={{ fontSize: 20 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap fontWeight={600} variant="body2">
                {file.name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatBytes(file.size)}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={0.75}>
            <Button
              size="small"
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
              size="small"
              variant="contained"
              startIcon={<DownloadRoundedIcon sx={{ fontSize: 16 }} />}
              onClick={handleConvert}
              disabled={loading}
            >
              {loading ? 'Converting…' : 'Convert'}
            </Button>
          </Stack>
        </Stack>
      )}

      {loading && (
        <Box sx={{ mb: 1.5 }}>
          <LinearProgress color="secondary" sx={{ height: 4, borderRadius: 1 }} />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            Reading PDF and building Excel…
          </Typography>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 1.5, py: 0.5, fontSize: '0.8rem' }}>
          {error}
        </Alert>
      )}

      {result && (
        <Alert severity="success" sx={{ py: 0.5, fontSize: '0.8rem' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {result.count} {result.recordLabel || 'transactions'} converted — Excel downloaded.
          </Typography>
        </Alert>
      )}
    </Box>
  );
}
