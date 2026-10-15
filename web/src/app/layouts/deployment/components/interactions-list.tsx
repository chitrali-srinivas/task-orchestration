import { Button } from "@/components/ui/button";
import { EngagementRecord } from "../data/schema";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ThumbsUp, ThumbsDown, MessageSquare, MapPin } from "lucide-react";

interface InteractionsListProps {
    data: EngagementRecord[];
    onItemClick: (item: EngagementRecord) => void;
}

export function InteractionsList({ data, onItemClick }: InteractionsListProps) {
    return (
        <div className="flex flex-col gap-4 max-w-5xl mx-auto">
            {data.map((item) => (
                <div
                    key={item.id}
                    onClick={() => onItemClick(item)}
                    className="group relative flex flex-col gap-3 p-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer"
                >
                    {/* Header */}
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 border border-zinc-200 dark:border-zinc-800">
                                <AvatarImage src={`/avatars/${(item.id % 5) + 1}.png`} alt={item.farmer.name} />
                                <AvatarFallback>{item.farmer.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                                <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">{item.farmer.name}</h4>
                                <div className="flex items-center gap-2 text-xs text-zinc-500">
                                    <span>{item.farmer.id}</span>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                        <MapPin className="h-3 w-3" /> {item.village}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                            <span className="text-xs text-zinc-400">
                                {formatDistanceToNow(new Date(item.submittedOn), { addSuffix: true })}
                            </span>
                            <Badge variant={item.status === 'Verified' ? 'default' : 'secondary'} className={cn(
                                "text-[10px] h-5",
                                item.status === 'Verified' && "bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400",
                                item.status === 'Invalid' && "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400",
                                item.status === 'Pending' && "bg-yellow-100 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400"
                            )}>
                                {item.status}
                            </Badge>
                        </div>
                    </div>

                    {/* Content - Simulating SurveyCard Style 5 Feedback */}
                    <div className="pl-[52px]">
                        <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-lg p-3 border border-zinc-100 dark:border-zinc-800">
                            <div className="flex items-center gap-2 mb-1.5">
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-zinc-300 text-zinc-500">
                                    {item.engagementType}
                                </Badge>
                                <div className="flex items-center gap-0.5 ml-auto">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <span key={star} className={cn(
                                            "text-sm",
                                            star <= item.score ? "text-amber-400" : "text-zinc-200 dark:text-zinc-700"
                                        )}>★</span>
                                    ))}
                                </div>
                            </div>
                            <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                                {item.comments}
                            </p>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pl-[52px] flex items-center gap-4 mt-1">
                        <Button variant="ghost" size="sm" className="h-auto p-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                            <ThumbsUp className="h-3.5 w-3.5 mr-1.5" />
                            <span className="text-xs">Helpful</span>
                        </Button>
                        <Button variant="ghost" size="sm" className="h-auto p-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                            <span className="text-xs">Comment</span>
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
}
