import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0B3D4A',
      light: '#165A6B',
      dark: '#072C36',
      contrastText: '#F4FAF8',
    },
    secondary: {
      main: '#3DB8A0',
      light: '#6DD0BC',
      dark: '#2A8F7B',
    },
    background: {
      default: '#EAF3F1',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#12262C',
      secondary: '#4A656C',
    },
    divider: 'rgba(11, 61, 74, 0.12)',
    success: {
      main: '#1F8A70',
    },
    error: {
      main: '#C0392B',
    },
  },
  typography: {
    fontFamily: '"Outfit", "Segoe UI", sans-serif',
    h1: {
      fontFamily: '"Source Serif 4", Georgia, serif',
      fontWeight: 600,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontFamily: '"Source Serif 4", Georgia, serif',
      fontWeight: 600,
    },
    h3: {
      fontFamily: '"Source Serif 4", Georgia, serif',
      fontWeight: 600,
    },
    h4: {
      fontFamily: '"Source Serif 4", Georgia, serif',
      fontWeight: 600,
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 14,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          paddingInline: 20,
          paddingBlock: 10,
          minHeight: 44,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

export default theme;
