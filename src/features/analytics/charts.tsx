import { useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-gifted-charts';

import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatShortDate } from '@/lib/datetime';
import { formatNumber, TABULAR } from '@/lib/format';
import { chartColors } from '@/theme/colors';
import { fonts } from '@/theme/fonts';
import { Text } from '@/components/ui/Text';

/**
 * Chart building blocks for Analytics (react-native-gifted-charts + react-native-svg, both work in
 * Expo Go). Calm, non-interactive charts: values are printed on bars / in legends, and every chart
 * card carries a spoken text summary for TalkBack (`summary`), since the web's hover tooltips have
 * no touch equivalent.
 */

const CHART_HEIGHT = 170;
const Y_LABEL_WIDTH = 30;
const AXIS_TEXT = { color: chartColors.axisText, fontSize: 11, fontFamily: fonts.regular };

export interface Datum {
  label: string;
  value: number;
  color?: string;
}

/** A Card that measures its width for the chart and reads `summary` to screen readers instead of the drawing. */
export function ChartCard({
  title,
  summary,
  empty,
  emptyMessage,
  children,
}: {
  title: string;
  summary: string;
  empty: boolean;
  emptyMessage: string;
  children: (width: number) => ReactNode;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const next = Math.floor(e.nativeEvent.layout.width);
    if (Math.abs(next - width) > 1) setWidth(next);
  };

  return (
    <Card title={title}>
      {empty ? (
        <EmptyState message={emptyMessage} />
      ) : (
        <View onLayout={onLayout} accessible accessibilityLabel={`${title}. ${summary}`}>
          <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            {width > 0 ? children(width) : <View style={{ height: CHART_HEIGHT }} />}
          </View>
        </View>
      )}
    </Card>
  );
}

/** Whole-number axis with ≤ 4 sections and room above the tallest bar for its value label. */
function integerScale(max: number): { maxValue: number; noOfSections: number } {
  const top = Math.max(1, Math.ceil(max * 1.15));
  if (top <= 4) return { maxValue: top, noOfSections: top };
  const step = Math.ceil(top / 4);
  return { maxValue: step * 4, noOfSections: 4 };
}

const integerLabel = (label: string) => String(Math.round(Number(label)));

/** Column chart (website: recharts BarChart with category X axis). Values print above the bars. */
export function ColumnChart({ data, color, width }: { data: Datum[]; color: string; width: number }) {
  const available = Math.max(80, width - Y_LABEL_WIDTH - 12);
  const slot = available / Math.max(1, data.length);
  const barWidth = Math.min(40, Math.max(12, slot * 0.55));
  const spacing = slot - barWidth;
  const { maxValue, noOfSections } = integerScale(Math.max(...data.map((d) => d.value), 0));

  return (
    <BarChart
      data={data.map((d) => ({ value: d.value, label: d.label, frontColor: d.color ?? color }))}
      width={available}
      height={CHART_HEIGHT}
      barWidth={barWidth}
      spacing={spacing}
      initialSpacing={spacing / 2}
      endSpacing={spacing / 2}
      labelWidth={slot}
      maxValue={maxValue}
      noOfSections={noOfSections}
      formatYLabel={integerLabel}
      yAxisLabelWidth={Y_LABEL_WIDTH}
      yAxisTextStyle={AXIS_TEXT}
      xAxisLabelTextStyle={{ ...AXIS_TEXT, textAlign: 'center' }}
      yAxisThickness={0}
      xAxisThickness={1}
      xAxisColor={chartColors.grid}
      rulesColor={chartColors.grid}
      rulesType="solid"
      barBorderTopLeftRadius={4}
      barBorderTopRightRadius={4}
      showValuesAsTopLabel
      topLabelTextStyle={{ ...AXIS_TEXT, color: '#374151', fontVariant: ['tabular-nums'] }}
      disablePress
      disableScroll
    />
  );
}

/**
 * Horizontal ranked bars drawn with Views (website: recharts vertical-layout BarChart). Long company
 * or category names stay readable on a phone, which rotated chart labels wouldn't.
 */
export function RankedBars({
  data,
  color,
  max,
  decimals = 0,
}: {
  data: Datum[];
  color: string;
  /** Scale end (e.g. 5 for ratings); defaults to the largest value. */
  max?: number;
  decimals?: number;
}) {
  const scaleMax = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <View className="gap-3">
      {data.map((d, i) => (
        <View key={`${d.label}-${i}`} className="gap-1">
          <View className="flex-row items-baseline gap-3">
            <Text className="flex-1 text-sm text-gray-700" numberOfLines={1}>
              {d.label}
            </Text>
            <Text className="text-sm font-medium text-gray-900" style={TABULAR}>
              {formatNumber(d.value, decimals)}
              {max ? <Text className="text-xs font-normal text-gray-500"> / {max}</Text> : null}
            </Text>
          </View>
          <View className="h-2 overflow-hidden rounded-full bg-gray-100">
            <View
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, (d.value / scaleMax) * 100)}%`, backgroundColor: d.color ?? color }}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Coloured dot + "Label: value" legend (website: EvaluationCharts legend). */
export function Legend({ items }: { items: Datum[] }) {
  return (
    <View className="mt-3 flex-row flex-wrap justify-center gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <View key={item.label} className="flex-row items-center gap-1.5">
          <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
          <Text className="text-xs text-gray-600" style={TABULAR}>
            {item.label}: {formatNumber(item.value)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Donut with the total in the middle and a legend (website: recharts Pie with innerRadius). */
export function DonutChart({ data }: { data: Datum[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <View className="items-center">
      <PieChart
        data={data.filter((d) => d.value > 0).map((d) => ({ value: d.value, color: d.color ?? chartColors.neutral }))}
        donut
        radius={76}
        innerRadius={50}
        innerCircleColor="#ffffff"
        strokeWidth={2}
        strokeColor="#ffffff"
        centerLabelComponent={() => (
          <View className="items-center">
            <Text className="text-xl font-semibold text-gray-900" style={TABULAR}>
              {formatNumber(total)}
            </Text>
            <Text className="text-xs text-gray-500">Total</Text>
          </View>
        )}
      />
      <Legend items={data} />
    </View>
  );
}

export interface LineSeries {
  label: string;
  color: string;
  values: number[];
}

/**
 * Daily trend line(s) (website: recharts LineChart, straight segments here so a line never dips
 * below zero). X labels: first, middle and last date, so they never collide.
 */
export function TrendChart({ dates, series, width }: { dates: string[]; series: LineSeries[]; width: number }) {
  const n = dates.length;
  const available = Math.max(80, width - Y_LABEL_WIDTH - 12);
  const edge = 10;
  const spacing = n > 1 ? (available - edge * 2) / (n - 1) : 0;
  const { maxValue, noOfSections } = integerScale(Math.max(0, ...series.flatMap((s) => s.values)));
  const [first, second] = series;
  const toData = (values: number[]) => values.map((value) => ({ value }));
  const tickIndexes = n <= 2 ? [...Array(n).keys()] : [0, Math.floor((n - 1) / 2), n - 1];

  return (
    <View>
      <LineChart
        data={toData(first.values)}
        data2={second ? toData(second.values) : undefined}
        color1={first.color}
        color2={second?.color}
        dataPointsColor1={first.color}
        dataPointsColor2={second?.color}
        thickness={2}
        hideDataPoints={n > 14}
        dataPointsRadius={3}
        width={available}
        height={CHART_HEIGHT}
        spacing={spacing}
        initialSpacing={n > 1 ? edge : available / 2}
        endSpacing={edge}
        maxValue={maxValue}
        noOfSections={noOfSections}
        formatYLabel={integerLabel}
        yAxisLabelWidth={Y_LABEL_WIDTH}
        yAxisTextStyle={AXIS_TEXT}
        yAxisThickness={0}
        xAxisThickness={1}
        xAxisColor={chartColors.grid}
        rulesColor={chartColors.grid}
        rulesType="solid"
        xAxisLabelsHeight={0}
        disableScroll
      />
      <View className="mt-1 flex-row justify-between" style={{ marginLeft: Y_LABEL_WIDTH }}>
        {tickIndexes.map((i) => (
          <Text key={i} style={AXIS_TEXT}>
            {formatShortDate(dates[i])}
          </Text>
        ))}
      </View>
      {series.length > 1 ? (
        <View className="mt-2 flex-row justify-center gap-4">
          {series.map((s) => (
            <View key={s.label} className="flex-row items-center gap-1.5">
              <View className="h-0.5 w-4 rounded-full" style={{ backgroundColor: s.color }} />
              <Text className="text-xs text-gray-600">{s.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Text alternatives
// ---------------------------------------------------------------------------

/** "Ongoing 3, Completed 1, Not Started 2." */
export function listSummary(data: Datum[], decimals = 0): string {
  return `${data.map((d) => `${d.label} ${formatNumber(d.value, decimals)}`).join(', ')}.`;
}

/** "From Sep 3 to Oct 2: 45 present in total, most on Sep 20 (8). 6 rejected in total, ..." */
export function trendSummary(dates: string[], series: LineSeries[]): string {
  if (dates.length === 0) return '';
  const range = `From ${formatShortDate(dates[0])} to ${formatShortDate(dates[dates.length - 1])}`;
  const parts = series.map((s) => {
    const total = s.values.reduce((a, b) => a + b, 0);
    const peak = Math.max(...s.values);
    const peakDate = dates[s.values.indexOf(peak)];
    return `${formatNumber(total)} ${s.label.toLowerCase()} in total${total > 0 ? `, most on ${formatShortDate(peakDate)} (${formatNumber(peak)})` : ''}`;
  });
  return `${range}: ${parts.join('. ')}.`;
}
