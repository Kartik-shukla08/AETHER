"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';
import {
  Activity, Clock, Cpu, CheckCircle, XCircle, ArrowUpRight, Zap, RefreshCw, Layers
} from 'lucide-react';
import styles from './DashboardView.module.css';

interface IngestedLog {
  id: string;
  conversationId: string;
  provider: string;
  model: string;
  latencyMs: number;
  ttftMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  requestPreview: string;
  responsePreview: string;
  status: 'success' | 'error';
  errorMessage?: string | null;
  createdAt: string;
}

interface TokenConsumption {
  input: number;
  output: number;
  total: number;
}

interface TelemetryMetrics {
  totalRequests: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  successRate: number;
  errorRate: number;
  tokenConsumption: TokenConsumption;
  providerSplits: Record<string, number>;
  recentLogs: IngestedLog[];
}

const COLORS = ['#6366f1', '#06b6d4', '#8b5cf6', '#3b82f6', '#10b981', '#f43f5e'];

export const DashboardView: React.FC = () => {
  const [metrics, setMetrics] = useState<TelemetryMetrics>({
    totalRequests: 0,
    avgLatencyMs: 0,
    p95LatencyMs: 0,
    successRate: 0,
    errorRate: 0,
    tokenConsumption: { input: 0, output: 0, total: 0 },
    providerSplits: {},
    recentLogs: [],
  });

  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [newLogPulse, setNewLogPulse] = useState(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connectWebSocket = () => {
    setWsStatus('connecting');
    // Using default port 4010 for local Ingestion websocket
    const wsUrl = process.env.NEXT_PUBLIC_INGESTION_WS_URL || 'ws://127.0.0.1:4010/ws';
    console.log('[WS] Connecting to URL:', wsUrl);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected to Telemetry service');
      setWsStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'metrics') {
          setMetrics(payload.data);
        } else if (payload.type === 'log') {
          setMetrics(payload.metrics);
          setNewLogPulse(true);
          setTimeout(() => setNewLogPulse(false), 800);
        }
      } catch (err) {
        console.error('[WS] Error parsing websocket message:', err);
      }
    };

    ws.onclose = () => {
      console.log('[WS] Connection closed. Retrying in 3 seconds...');
      setWsStatus('disconnected');
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = () => {
      console.warn('[WS] Connection to telemetry service failed. Will retry...');
      ws.close();
    };
  };

  // HTTP Fallback to load initial metrics if WS takes time or isn't connected
  const fetchMetricsHttp = async () => {
    try {
      const res = await fetch('http://127.0.0.1:4010/metrics');
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (e) {
      console.error('[HTTP] Failed to fetch initial metrics:', e);
    }
  };

  useEffect(() => {
    connectWebSocket();
    fetchMetricsHttp();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  const toggleLogExpansion = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  // Prepare chart data for line chart (Latency and TTFT over time)
  // We need to reverse the logs to show chronological order
  const timeSeriesData = [...metrics.recentLogs]
    .reverse()
    .map((log, index) => ({
      index: index + 1,
      id: log.id.slice(0, 8),
      latency: log.latencyMs,
      ttft: log.ttftMs,
      provider: log.provider,
      model: log.model,
    }));

  // Prepare chart data for token bar chart
  const tokenChartData = [...metrics.recentLogs]
    .reverse()
    .map((log) => ({
      id: log.id.slice(0, 8),
      input: log.inputTokens,
      output: log.outputTokens,
      total: log.totalTokens,
    }));

  // Prepare chart data for provider splits pie chart
  const pieData = Object.entries(metrics.providerSplits).map(([name, value]) => ({
    name: name.toUpperCase(),
    value,
  }));

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h2>Telemetry & System Observability</h2>
          <p className={styles.subtext}>
            Live analysis of LLM inference metrics, latency characteristics, and token consumption.
          </p>
        </div>
        <div className={styles.statusSection}>
          <div className={`${styles.statusDot} ${styles[wsStatus]}`}></div>
          <span className={styles.statusText}>
            {wsStatus === 'connected' && 'Live Ingestion Stream Connected'}
            {wsStatus === 'connecting' && 'Connecting to Ingestion...'}
            {wsStatus === 'disconnected' && 'Disconnected. Retrying...'}
          </span>
          <button className={styles.refreshBtn} onClick={fetchMetricsHttp} title="Refresh metrics manually">
            <RefreshCw size={14} className={wsStatus === 'connecting' ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className={styles.metricsGrid}>
        <div className={`${styles.card} ${newLogPulse ? styles.pulseBorder : ''}`}>
          <div className={styles.cardHeader}>
            <Activity className={styles.iconViolet} size={20} />
            <h3>Total Requests</h3>
          </div>
          <p className={styles.cardValue}>{metrics.totalRequests}</p>
          <div className={styles.cardFooter}>
            <span className={styles.footerAccent}>Real-time logs count</span>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <Clock className={styles.iconCyan} size={20} />
            <h3>Avg Latency</h3>
          </div>
          <p className={styles.cardValue}>{metrics.avgLatencyMs.toFixed(0)}<span className={styles.unit}>ms</span></p>
          <div className={styles.cardFooter}>
            <span>P95 Latency: </span>
            <span className={styles.footerAccent}>{metrics.p95LatencyMs.toFixed(0)} ms</span>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <Cpu className={styles.iconPurple} size={20} />
            <h3>Token Usage</h3>
          </div>
          <p className={styles.cardValue}>
            {(metrics.tokenConsumption.total / 1000).toFixed(1)}<span className={styles.unit}>k</span>
          </p>
          <div className={styles.cardFooter}>
            <span>In: </span>
            <span className={styles.footerAccent}>{(metrics.tokenConsumption.input / 1000).toFixed(1)}k</span>
            <span style={{ marginLeft: 8 }}>Out: </span>
            <span className={styles.footerAccent}>{(metrics.tokenConsumption.output / 1000).toFixed(1)}k</span>
          </div>
        </div>

        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <CheckCircle className={styles.iconGreen} size={20} />
            <h3>Success Rate</h3>
          </div>
          <p className={styles.cardValue}>{metrics.successRate.toFixed(1)}<span className={styles.unit}>%</span></p>
          <div className={styles.cardFooter}>
            <span>Error rate: </span>
            <span className={styles.errorText}>{metrics.errorRate.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Visual Charts Grid */}
      <div className={styles.chartsGrid}>
        {/* Latency & TTFT Line Chart */}
        <div className={styles.chartCard}>
          <h3>Latency & Time-to-First-Token (Last 20 requests)</h3>
          <div className={styles.chartContainer}>
            {timeSeriesData.length === 0 ? (
              <div className={styles.noChartData}>No inference events recorded yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="index" stroke="var(--text-muted)" fontSize={11} />
                  <YAxis stroke="var(--text-muted)" fontSize={11} unit="ms" />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-secondary)',
                      borderColor: 'var(--glass-border)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '12px'
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', marginTop: '10px' }} />
                  <Line
                    type="monotone"
                    dataKey="latency"
                    name="Total Latency (ms)"
                    stroke="var(--chart-line-latency)"
                    strokeWidth={2.5}
                    activeDot={{ r: 6 }}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ttft"
                    name="TTFT (ms)"
                    stroke="var(--chart-line-ttft)"
                    strokeWidth={2.5}
                    activeDot={{ r: 6 }}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Provider Splits Pie & Token Consumption Bar */}
        <div className={styles.providerGrid}>
          <div className={styles.chartCard}>
            <h3>Provider Splits</h3>
            <div className={styles.chartContainer}>
              {pieData.length === 0 ? (
                <div className={styles.noChartData}>No data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-secondary)',
                        borderColor: 'var(--glass-border)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '12px'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className={styles.chartCard}>
            <h3>Tokens Transmitted</h3>
            <div className={styles.chartContainer}>
              {tokenChartData.length === 0 ? (
                <div className={styles.noChartData}>No data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tokenChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="id" stroke="var(--text-muted)" fontSize={9} />
                    <YAxis stroke="var(--text-muted)" fontSize={10} />
                    <Tooltip
                      contentStyle={{
                        background: 'var(--bg-secondary)',
                        borderColor: 'var(--glass-border)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '12px'
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Bar dataKey="input" name="Prompt Tokens" fill="var(--chart-bar-input)" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="output" name="Completion Tokens" fill="var(--chart-bar-output)" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Logs Table */}
      <div className={styles.logsSection}>
        <div className={styles.logsHeader}>
          <h3>Recent Inference Telemetry Streams</h3>
          <span className={styles.logsCounter}>Showing last {metrics.recentLogs.length} events</span>
        </div>

        <div className={styles.logsTableWrapper}>
          <table className={styles.logsTable}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th>Status</th>
                <th>Provider / Model</th>
                <th>Latency / TTFT</th>
                <th>Token Consumption</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {metrics.recentLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className={styles.noLogsRow}>
                    Waiting for telemetry ingestion logs. Send messages in the chat console to populate!
                  </td>
                </tr>
              ) : (
                metrics.recentLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        className={`${styles.logRow} ${isExpanded ? styles.expandedRow : ''}`}
                        onClick={() => toggleLogExpansion(log.id)}
                      >
                        <td className={styles.expandCell}>
                          <ArrowUpRight
                            size={16}
                            style={{
                              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s ease',
                              color: 'var(--text-muted)'
                            }}
                          />
                        </td>
                        <td>
                          {log.status === 'success' ? (
                            <span className={`${styles.statusLabel} ${styles.statusSuccess}`}>
                              <CheckCircle size={12} />
                              <span>200 OK</span>
                            </span>
                          ) : (
                            <span className={`${styles.statusLabel} ${styles.statusError}`}>
                              <XCircle size={12} />
                              <span>500 ERR</span>
                            </span>
                          )}
                        </td>
                        <td>
                          <div className={styles.providerInfo}>
                            <span className={styles.logProvider}>{log.provider}</span>
                            <span className={styles.logModel}>{log.model}</span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.latencyInfo}>
                            <span className={styles.totalLatency}><Clock size={12} /> {log.latencyMs}ms</span>
                            <span className={styles.ttftInfo}><Zap size={11} /> TTFT: {log.ttftMs}ms</span>
                          </div>
                        </td>
                        <td>
                          <div className={styles.tokenInfo}>
                            <span className={styles.totalTokens}>{log.totalTokens} tns</span>
                            <span className={styles.tokenDetails}>in:{log.inputTokens} / out:{log.outputTokens}</span>
                          </div>
                        </td>
                        <td className={styles.timestampCell}>
                          {new Date(log.createdAt).toLocaleTimeString()}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className={styles.detailsRow}>
                          <td colSpan={6}>
                            <div className={styles.detailsContainer}>
                              <div className={styles.detailsHeader}>
                                <span>ID: <code className={styles.idCode}>{log.id}</code></span>
                                <span>Conv: <code className={styles.idCode}>{log.conversationId}</code></span>
                              </div>
                              <div className={styles.detailsBody}>
                                <div className={styles.payloadBox}>
                                  <h4>Sanitized Request Preview</h4>
                                  <pre className={styles.prePayload}>
                                    <code>{log.requestPreview}</code>
                                  </pre>
                                </div>
                                <div className={styles.payloadBox}>
                                  <h4>Sanitized Response Preview</h4>
                                  <pre className={styles.prePayload}>
                                    <code className={log.status === 'error' ? styles.errorMessage : ''}>
                                      {log.status === 'error' ? log.errorMessage || log.responsePreview : log.responsePreview}
                                    </code>
                                  </pre>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
