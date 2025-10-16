import React, { useMemo } from 'react';

import { View } from '@actual-app/components/view';

export type SparklineProps = {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  backgroundColor?: string;
  strokeWidth?: number;
  ariaLabel?: string;
};

function normalize(
  value: number,
  min: number,
  max: number,
  size: number,
): number {
  if (max === min) {
    return size / 2;
  }

  const ratio = (value - min) / (max - min);
  return size - ratio * size;
}

export function Sparkline({
  data,
  width = 160,
  height = 48,
  color = 'url(#sparklineGradient)',
  backgroundColor = 'rgba(255, 255, 255, 0.08)',
  strokeWidth = 2.5,
  ariaLabel,
}: SparklineProps) {
  const dimensions = useMemo(() => {
    const normalizedData = data.length > 0 ? data : [0];
    const min = Math.min(...normalizedData);
    const max = Math.max(...normalizedData);
    const points = normalizedData.map((value, index) => {
      const x = (index / Math.max(1, normalizedData.length - 1)) * width;
      const y = normalize(value, min, max, height);
      return `${x},${y}`;
    });

    const areaPoints = [`0,${height}`, ...points, `${width},${height}`].join(' ');

    return { min, max, points: points.join(' '), areaPoints };
  }, [data, height, width]);

  return (
    <View
      role="img"
      aria-label={ariaLabel}
      style={{
        width,
        height,
        position: 'relative',
      }}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="sparklineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(59, 130, 246, 0.65)" />
            <stop offset="100%" stopColor="rgba(37, 99, 235, 0.05)" />
          </linearGradient>
        </defs>

        <polyline
          points={dimensions.areaPoints}
          fill={backgroundColor}
          stroke="none"
        />
        <polyline
          points={dimensions.points}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      </svg>
    </View>
  );
}
