import { Box, FormHelperText, Typography } from '@mui/material';
import { Editor } from '@tinymce/tinymce-react';
import 'tinymce/tinymce';
import 'tinymce/icons/default';
import 'tinymce/themes/silver';
import 'tinymce/models/dom';
import 'tinymce/plugins/autolink';
import 'tinymce/plugins/code';
import 'tinymce/plugins/link';
import 'tinymce/plugins/lists';
import 'tinymce/plugins/table';
import 'tinymce/skins/ui/oxide/skin.css';
import './editorVietnamese';
import { roomDescriptionEditorValue } from '../roomDescription';

export function RoomDescriptionEditor({
  value,
  label = "Mô tả loại phòng",
  onChange,
  onBlur,
  disabled,
  error,
}: {
  value: string;
  label?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  error?: string;
}) {
  return <Box>
    <Typography variant="body2" sx={{ mb: 0.75, fontWeight: 700 }}>
      {label}
    </Typography>
    <Box
      sx={{
        border: 1,
        borderColor: error ? 'error.main' : 'divider',
        borderRadius: 1.5,
        overflow: 'hidden',
        '& .tox-tinymce': { border: 0, borderRadius: 0 },
      }}
    >
      <Editor
        tinymceScriptSrc={[]}
        licenseKey="gpl"
        value={roomDescriptionEditorValue(value)}
        disabled={disabled}
        onEditorChange={onChange}
        onBlur={onBlur}
        init={{
          language: 'vi',
          height: 300,
          menubar: false,
          statusbar: false,
          branding: false,
          promotion: false,
          skin: false,
          content_css: false,
          plugins: ['autolink', 'link', 'lists', 'table', 'code'],
          toolbar: 'undo redo | blocks | bold italic underline | bullist numlist | alignleft aligncenter alignright | link table | removeformat | code',
          block_formats: 'Đoạn văn=p; Tiêu đề 2=h2; Tiêu đề 3=h3; Tiêu đề 4=h4',
          content_style: 'body { font-family: Inter, Arial, sans-serif; font-size: 15px; line-height: 1.6; padding: 4px 8px; } p { margin: 0; }',
        }}
      />
    </Box>
    {error && <FormHelperText error sx={{ mx: 1.75, mt: 0.5 }}>{error}</FormHelperText>}
  </Box>;
}
