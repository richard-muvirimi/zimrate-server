import { useMediaQuery } from '@mui/material';

/** Transition duration to use, collapsing to 0 when the user asks for reduced motion. */
export function useMotionTimeout(timeout = 600) {
  const reduce = useMediaQuery('(prefers-reduced-motion: reduce)');
  return reduce ? 0 : timeout;
}

export default useMotionTimeout;
