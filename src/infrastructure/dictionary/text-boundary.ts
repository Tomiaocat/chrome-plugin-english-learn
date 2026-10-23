import type { TextBoundaryPort } from '../../domain/ports';

const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
export const chineseTextBoundary: TextBoundaryPort = {
  boundaries(text) {
    const boundaries = new Set<number>([0, text.length]);
    for (const segment of segmenter.segment(text)) {
      boundaries.add(segment.index);
      boundaries.add(segment.index + segment.segment.length);
    }
    return boundaries;
  },
};
