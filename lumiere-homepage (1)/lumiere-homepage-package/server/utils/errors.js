export class HttpError extends Error {
  constructor(status, message, fields = undefined, code = undefined) {
    super(message); this.status = status; this.fields = fields; this.code = code;
  }
}
export const asyncHandler = handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  if (error.code === 11000) return res.status(409).json({ message: 'An account with this email already exists.', fields: { email: 'This email is already registered. Please sign in.' } });
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'Choose an image smaller than 8 MB.', fields: { image: 'The maximum image size is 8 MB.' } });
  if (error.name === 'MulterError') return res.status(400).json({ message: 'Upload one JPG, PNG, or WebP image using the image field.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ message: 'The submitted form is too large.' });
  if (error instanceof SyntaxError && error.status === 400) return res.status(400).json({ message: 'The submitted data is not valid JSON.' });
  if (error.name === 'ValidationError') return res.status(422).json({ message: 'Please check the painting details.', fields: Object.fromEntries(Object.entries(error.errors).map(([key, value]) => [key, value.message])) });
  if (!error.status) console.error('Request failed:', error.name || 'UnknownError');
  res.status(error.status || 500).json({ message: error.status ? error.message : 'Something went wrong. Please try again.', ...(error.fields && { fields: error.fields }), ...(error.code && error.status && { code: error.code }) });
}
