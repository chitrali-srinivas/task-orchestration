"use client";

import React, { useState } from "react";
import { 
  Tractor as TractorIcon, 
  Truck, 
  MapPin, 
  CheckCircle2, 
  FileText, 
  ExternalLink, 
  ChevronRight, 
  Video, 
  Image as ImageIcon, 
  Maximize2,
  CheckSquare,
  Square
} from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    FarmerDeployment, 
    Tractor, 
    Load, 
    Plot 
} from "../data/dummy-data";

interface DeploymentSidebarProps {
  data: FarmerDeployment;
  onUpdateData: (newData: FarmerDeployment) => void;
}

export const DeploymentSidebar = ({ data, onUpdateData }: DeploymentSidebarProps) => {
  const [selectedLoads, setSelectedLoads] = useState<Set<string>>(new Set());
  const [expandedLoads, setExpandedLoads] = useState<Set<string>>(new Set());

  const toggleLoadSelection = (loadId: string) => {
    const newSelected = new Set(selectedLoads);
    if (newSelected.has(loadId)) {
      newSelected.delete(loadId);
    } else {
      newSelected.add(loadId);
    }
    setSelectedLoads(newSelected);
  };

  const toggleAllLoads = () => {
    const allLoadIds: string[] = [];
    data.tractors.forEach(t => t.loads.forEach(l => allLoadIds.push(l.id)));
    
    if (selectedLoads.size === allLoadIds.length) {
      setSelectedLoads(new Set());
    } else {
      setSelectedLoads(new Set(allLoadIds));
    }
  };

  const toggleLoadExpansion = (loadId: string) => {
    const newExpanded = new Set(expandedLoads);
    if (newExpanded.has(loadId)) {
      newExpanded.delete(loadId);
    } else {
      newExpanded.add(loadId);
    }
    setExpandedLoads(newExpanded);
  };

  const handleApproveSelected = () => {
    const newData = { ...data };
    newData.tractors = newData.tractors.map(t => ({
      ...t,
      loads: t.loads.map(l => {
        if (selectedLoads.has(l.id)) {
          return {
            ...l,
            isApproved: true,
            plots: l.plots.map(p => ({ ...p, isApproved: true }))
          };
        }
        return l;
      })
    }));
    onUpdateData(newData);
    console.log("Approved loads:", Array.from(selectedLoads));
  };

  const handleApproveAll = () => {
    const newData = { ...data };
    newData.tractors = newData.tractors.map(t => ({
      ...t,
      loads: t.loads.map(l => ({
        ...l,
        isApproved: true,
        plots: l.plots.map(p => ({ ...p, isApproved: true }))
      }))
    }));
    onUpdateData(newData);
    console.log("Approved all loads");
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800">
      {/* Header Section */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{data.name}</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center mt-1">
              <MapPin className="h-3 w-3 mr-1" /> {data.location}
            </p>
            <p className="text-[10px] text-zinc-400 mt-0.5">ID: {data.id}</p>
          </div>
          <Badge variant="secondary" className="bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-50 font-bold px-2 py-1">
            {data.totalDeployedQty}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full text-xs h-8">
                <FileText className="h-3.5 w-3.5 mr-1.5" /> View NOC Doc
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>NOC Document - {data.name}</DialogTitle>
              </DialogHeader>
              <div className="aspect-[4/3] bg-zinc-100 dark:bg-zinc-900 rounded-md flex items-center justify-center border border-dashed border-zinc-300 dark:border-zinc-700">
                 <div className="text-center space-y-2">
                    <FileText className="h-12 w-12 mx-auto text-zinc-400" />
                    <p className="text-sm text-zinc-500">Dummy NOC Document Preview</p>
                 </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => console.log("Rejected NOC")}>Reject</Button>
                <Button className="bg-zinc-900 dark:bg-zinc-50" onClick={() => console.log("Approved NOC")}>Approve</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" className="w-full text-xs h-8" onClick={() => alert("Navigating to Samples...")}>
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Go to Samples
          </Button>
        </div>
      </div>

      {/* Main Content - Accordion for Tractors */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <Accordion type="multiple" defaultValue={data.tractors.map(t => t.id)} className="space-y-3">
            {data.tractors.map((tractor) => (
              <AccordionItem key={tractor.id} value={tractor.id} className="border rounded-lg overflow-hidden border-zinc-200 dark:border-zinc-800">
                <AccordionTrigger className="px-4 py-3 hover:no-underline bg-zinc-50/50 dark:bg-zinc-900/30">
                  <div className="flex items-center justify-between w-full pr-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-md">
                        <TractorIcon className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{tractor.regNumber}</p>
                        <p className="text-[10px] text-zinc-500">{tractor.source}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold">
                      {tractor.totalQuantity}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-zinc-50/50 dark:bg-zinc-900/50">
                        <TableRow>
                          <TableHead className="w-[40px] px-2 text-center">
                            <Checkbox 
                                checked={tractor.loads.every(l => selectedLoads.has(l.id))}
                                onCheckedChange={() => {
                                    const allSelected = tractor.loads.every(l => selectedLoads.has(l.id));
                                    const newSelected = new Set(selectedLoads);
                                    tractor.loads.forEach(l => {
                                        if (allSelected) newSelected.delete(l.id);
                                        else newSelected.add(l.id);
                                    });
                                    setSelectedLoads(newSelected);
                                }}
                            />
                          </TableHead>
                          <TableHead className="text-[10px] uppercase font-bold px-2">Load Details</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold px-2 text-right">Qty</TableHead>
                          <TableHead className="w-[40px] px-2"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tractor.loads.map((load) => (
                          <React.Fragment key={load.id}>
                            <TableRow className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 border-zinc-100 dark:border-zinc-800">
                              <TableCell className="px-2 text-center">
                                <Checkbox 
                                  checked={selectedLoads.has(load.id)}
                                  onCheckedChange={() => toggleLoadSelection(load.id)}
                                />
                              </TableCell>
                              <TableCell className="px-2 py-3">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-medium text-zinc-900 dark:text-zinc-50">{load.id}</span>
                                    {load.isApproved && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                                  </div>
                                  <p className="text-[10px] text-zinc-500 line-clamp-1">{load.azName} • {load.date}</p>
                                </div>
                              </TableCell>
                              <TableCell className="px-2 text-right">
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-zinc-100 dark:bg-zinc-800">
                                  {load.totalLoadQty}
                                </Badge>
                              </TableCell>
                              <TableCell className="px-2">
                                <div className="flex items-center gap-1">
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7">
                                                <Video className="h-3.5 w-3.5 text-zinc-400" />
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>Load Video - {load.id}</DialogTitle>
                                            </DialogHeader>
                                            <div className="aspect-video bg-black rounded-md overflow-hidden">
                                                <video src={load.videoUrl} controls className="w-full h-full" />
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-7 w-7"
                                        onClick={() => toggleLoadExpansion(load.id)}
                                    >
                                        <ChevronRight className={`h-3.5 w-3.5 text-zinc-400 transition-transform ${expandedLoads.has(load.id) ? 'rotate-90' : ''}`} />
                                    </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                            
                            {/* Expanded Plots Section */}
                            {expandedLoads.has(load.id) && (
                              <TableRow className="bg-zinc-50/30 dark:bg-zinc-900/10">
                                <TableCell colSpan={4} className="p-0">
                                  <div className="px-8 py-3 space-y-2 border-l-2 border-zinc-200 dark:border-zinc-800 ml-4 my-1">
                                    {load.plots.map((plot) => (
                                      <div key={plot.id} className="flex items-center justify-between p-2 rounded-md bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 shadow-sm">
                                        <div className="flex items-center gap-3">
                                          <Dialog>
                                            <DialogTrigger asChild>
                                              <div className="relative h-10 w-10 rounded overflow-hidden cursor-zoom-in group/img">
                                                <img src={plot.photoUrl} alt={plot.id} className="h-full w-full object-cover" />
                                                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                                                  <Maximize2 className="h-3 w-3 text-white" />
                                                </div>
                                              </div>
                                            </DialogTrigger>
                                            <DialogContent className="max-w-2xl">
                                              <DialogHeader>
                                                <DialogTitle>Plot Photo - {plot.id}</DialogTitle>
                                              </DialogHeader>
                                              <img src={plot.photoUrl} alt={plot.id} className="w-full rounded-md" />
                                            </DialogContent>
                                          </Dialog>
                                          <div>
                                            <div className="flex items-center gap-1.5">
                                              <p className="text-[11px] font-bold text-zinc-900 dark:text-zinc-50">{plot.id}</p>
                                              {plot.isApproved && <CheckCircle2 className="h-2.5 w-2.5 text-green-500" />}
                                            </div>
                                            <div className="flex gap-2">
                                              <span className="text-[9px] text-zinc-500">Area: {plot.area}</span>
                                              <span className="text-[9px] text-zinc-500">Deployed: {plot.amountDeployed}</span>
                                            </div>
                                          </div>
                                        </div>
                                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 ${plot.isApproved ? 'border-green-500 text-green-600 bg-green-50' : 'text-zinc-400'}`}>
                                          {plot.isApproved ? 'Verified' : 'Pending'}
                                        </Badge>
                                      </div>
                                    ))}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </ScrollArea>

      {/* Footer Section - Bulk Actions */}
      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Checkbox 
                id="select-all" 
                checked={selectedLoads.size > 0 && selectedLoads.size === data.tractors.reduce((acc, t) => acc + t.loads.length, 0)}
                onCheckedChange={toggleAllLoads}
            />
            <label htmlFor="select-all" className="text-xs font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer">
              Select All Loads ({selectedLoads.size})
            </label>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Button 
            variant="outline" 
            className="text-xs h-9 border-zinc-300 dark:border-zinc-700"
            disabled={selectedLoads.size === 0}
            onClick={handleApproveSelected}
          >
            Approve Selected
          </Button>
          <Button 
            className="text-xs h-9 bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            onClick={handleApproveAll}
          >
            Approve All
          </Button>
        </div>
      </div>
    </div>
  );
};
