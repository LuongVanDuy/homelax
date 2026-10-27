
/** Auth forms use the shared website inputs with a taller, 50px control. */
export const authFormSx = {
  '& .MuiOutlinedInput-root:not(.MuiInputBase-multiline)': {
    minHeight: 50,
    height: 50,
    '& .MuiOutlinedInput-input': { paddingBlock: '14px' },
  },
  '& .MuiInputLabel-outlined:not(.MuiInputLabel-shrink)': {
    transform: 'translate(14px, 14px) scale(1)',
  },
};

export const publicAuthFormSx = {
  ...authFormSx,
  '& .MuiOutlinedInput-root': { borderRadius: '10px', fontSize: 16 },
};

export const publicAuthSubmitSx = {
  height: 50,
  minHeight: 50,
  borderRadius: '10px',
  fontSize: 15,
  fontWeight: 700,
  boxShadow: 'none',
  '&.Mui-focusVisible': { outline: '3px solid', outlineColor: 'secondary.main', outlineOffset: 3 },
};
