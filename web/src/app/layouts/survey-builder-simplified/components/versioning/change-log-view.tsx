"use client";

import React from "react";
import { User, GitCommit } from "lucide-react";
import { AuditLogEntry } from "../../types/survey-schema";

interface ChangeLogViewProps {
    logs: AuditLogEntry[];
}

export function ChangeLogView({ logs }: ChangeLogViewProps) {
    if (logs.length === 0) {
        return (
            <div className="p-8 text-center text-xs text-zinc-500">
                No recent mutations recorded in audit log.
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {logs.map((log) => (
                <div
                    key={log.id}
                    className="p-3 rounded-lg bg-zinc-50/70 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 text-xs space-y-1"
                >
                    <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 font-bold text-zinc-800 dark:text-zinc-200">
                            <GitCommit className="h-3.5 w-3.5 text-zinc-600 dark:text-zinc-400" />
                            <span>{log.action}</span>
                        </div>
                        <span className="font-mono text-[10px] text-zinc-400">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>

                    <p className="text-zinc-600 dark:text-zinc-400 text-[11px] leading-relaxed">
                        {log.summary}
                    </p>

                    <div className="flex items-center gap-1 text-[10px] text-zinc-400 pt-0.5">
                        <User className="h-3 w-3" />
                        <span>{log.user}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}
