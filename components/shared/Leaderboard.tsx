"use client";

import { useState } from "react";
import type { LeaderboardData, LeaderboardEntry, Team } from "@/lib/types";

interface LeaderboardProps {
	data: LeaderboardData;
	teams: Team[];
	highlightPlayerId?: string;
}

export function Leaderboard({ data, teams, highlightPlayerId }: LeaderboardProps) {
	const [tab, setTab] = useState<"individual" | "teams">("individual");
	const entries = tab === "individual" ? data.individual : data.teams;

	return (
		<div className="w-full space-y-4">
			{/* Tab switcher */}
			<div className="flex rounded-xl bg-card p-1">
				<button
					type="button"
					onClick={() => setTab("individual")}
					className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
						tab === "individual"
							? "bg-accent text-white"
							: "text-muted hover:text-foreground"
					}`}
				>
					Individual
				</button>
				<button
					type="button"
					onClick={() => setTab("teams")}
					className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
						tab === "teams"
							? "bg-accent text-white"
							: "text-muted hover:text-foreground"
					}`}
				>
					Teams
				</button>
			</div>

			{/* Podium for top 3 */}
			{entries.length >= 3 && (
				<div className="flex items-end justify-center gap-2 py-4">
					{/* 2nd place */}
					<PodiumItem entry={entries[1]} place={2} height="h-24" teams={teams} />
					{/* 1st place */}
					<PodiumItem entry={entries[0]} place={1} height="h-32" teams={teams} />
					{/* 3rd place */}
					<PodiumItem entry={entries[2]} place={3} height="h-20" teams={teams} />
				</div>
			)}

			{/* Full list */}
			<div className="space-y-1 max-h-80 overflow-y-auto">
				{entries.map((entry) => (
					<LeaderboardRow
						key={entry.id}
						entry={entry}
						teams={teams}
						isHighlighted={entry.id === highlightPlayerId}
						isTeamTab={tab === "teams"}
					/>
				))}
			</div>
		</div>
	);
}

function PodiumItem({
	entry,
	place,
	height,
	teams,
}: {
	entry: LeaderboardEntry;
	place: number;
	height: string;
	teams: Team[];
}) {
	const team = teams.find((t) => t.id === entry.teamId);
	const medals = ["", "#FFD700", "#C0C0C0", "#CD7F32"];
	const medalColor = medals[place] ?? "#CD7F32";

	return (
		<div className="flex w-24 flex-col items-center gap-1 animate-slide-up" style={{ animationDelay: `${(place - 1) * 100}ms` }}>
			<p className="text-sm font-medium truncate max-w-full text-center" title={entry.name}>
				{entry.name}
			</p>
			<p className="text-xs text-muted">{entry.score.toFixed(2)}</p>
			<div
				className={`${height} w-full rounded-t-lg flex items-start justify-center pt-2`}
				style={{ backgroundColor: team?.color ?? medalColor, opacity: 0.85 }}
			>
				<span className="text-2xl font-bold text-white">{place}</span>
			</div>
		</div>
	);
}

function LeaderboardRow({
	entry,
	teams,
	isHighlighted,
	isTeamTab,
}: {
	entry: LeaderboardEntry;
	teams: Team[];
	isHighlighted: boolean;
	isTeamTab: boolean;
}) {
	const team = teams.find((t) => t.id === (isTeamTab ? entry.id : entry.teamId));
	const rankChange = entry.previousRank !== null ? entry.previousRank - entry.rank : 0;

	return (
		<div
			className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
				isHighlighted ? "bg-accent/20 border border-accent/40" : "bg-card/50"
			}`}
		>
			{/* Rank */}
			<span className="w-8 text-center text-sm font-bold text-muted">#{entry.rank}</span>

			{/* Rank change indicator */}
			<span className="w-6 text-center text-xs">
				{rankChange > 0 && <span className="text-answer-green">&#9650;{rankChange}</span>}
				{rankChange < 0 && <span className="text-answer-red">&#9660;{Math.abs(rankChange)}</span>}
				{rankChange === 0 && entry.previousRank !== null && <span className="text-muted">&ndash;</span>}
			</span>

			{/* Name + team indicator */}
			<div className="flex-1 min-w-0">
				<p className="font-medium truncate">{entry.name}</p>
				{team && !isTeamTab && (
					<div className="flex items-center gap-1 mt-0.5">
						<span
							className="inline-block h-2 w-2 rounded-full"
							style={{ backgroundColor: team.color }}
						/>
						<span className="text-xs text-muted">{team.name}</span>
					</div>
				)}
			</div>

			{/* Score */}
			<span className="font-mono font-bold text-accent">{entry.score.toFixed(2)}</span>
		</div>
	);
}
