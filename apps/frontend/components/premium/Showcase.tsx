'use client';

import React from 'react';
import { motion, type Variants } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, PremiumAvatar } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  AnimatedTable, 
  TableHeader, 
  TableRow, 
  TableHead, 
  AnimatedTableBody, 
  TableCell, 
  AnimatedTableRow 
} from '@/components/ui/table';
import { 
  Mail, 
  Star, 
  Zap, 
  ArrowUpRight, 
  BarChart4, 
  Users, 
  CreditCard, 
  Coffee, 
  ChevronRight,
  PieChart,
  Paperclip
} from 'lucide-react';

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.3,
    },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: "spring",
      stiffness: 100,
      damping: 15
    }
  },
};

export default function PremiumShowcase() {
  return (
    <div className="flex flex-col space-y-12 py-10">
      <section>
        <h2 className="premium-text text-3xl font-bold mb-8">Premium UI Components</h2>
        
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {/* Premium Card */}
          <motion.div variants={item}>
            <Card className="premium-card">
              <CardHeader>
                <CardTitle>Premium Card</CardTitle>
                <CardDescription>Enhanced card with 3D effects and gradients</CardDescription>
              </CardHeader>
              <CardContent>
                <p>This card features subtle gradient overlays, shadow depth, and interactive hover states.</p>
                <div className="flex items-center gap-2 mt-4">
                  <div className="size-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Premium Feature</p>
                    <p className="text-xs text-muted-foreground">Enhanced visuals</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="premium" className="w-full">
                  Premium Button
                  <ArrowUpRight className="h-4 w-4 ml-2" />
                </Button>
              </CardFooter>
            </Card>
          </motion.div>

          {/* Stats Card */}
          <motion.div variants={item}>
            <Card className="premium-card">
              <CardHeader className="pb-2">
                <CardTitle>Stats Card</CardTitle>
                <CardDescription>Interactive metric display</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold animate-pulse-subtle">2,853</div>
                <div className="text-xs text-muted-foreground">
                  <span className="text-emerald-500 font-medium">+12%</span> from last month
                </div>
                <div className="mt-4 h-1">
                  <Progress value={75} className="h-2" />
                </div>
              </CardContent>
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <BarChart4 className="h-12 w-12 text-primary" />
              </div>
            </Card>
          </motion.div>

          {/* Glass Effect Card */}
          <motion.div variants={item}>
            <div className="glass-effect p-6 rounded-xl h-full">
              <h3 className="font-semibold mb-2">Glass Effect</h3>
              <p className="text-sm mb-4">Modern frosted glass appearance for UI elements</p>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="outline" className="bg-white/20 dark:bg-slate-900/20">Badge 1</Badge>
                <Badge variant="outline" className="bg-white/20 dark:bg-slate-900/20">Badge 2</Badge>
                <Badge variant="outline" className="bg-white/20 dark:bg-slate-900/20">Badge 3</Badge>
              </div>
              <Button variant="outline" className="w-full bg-white/20 dark:bg-slate-900/20">
                Glass Button
              </Button>
            </div>
          </motion.div>
        </motion.div>
      </section>

      <section>
        <h2 className="premium-text text-3xl font-bold mb-8">Premium Text & Animations</h2>
        
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {/* Premium Text */}
          <motion.div variants={item}>
            <Card>
              <CardHeader>
                <CardTitle>Premium Text</CardTitle>
                <CardDescription>Gradient text effects</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <h1 className="premium-text text-4xl font-bold">Gradient Heading</h1>
                <h2 className="premium-text text-2xl font-semibold">Subtitle Example</h2>
                <p className="premium-text text-lg">Regular text with gradient</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Floating Animation */}
          <motion.div variants={item}>
            <Card>
              <CardHeader>
                <CardTitle>Floating Animation</CardTitle>
                <CardDescription>Subtle movement effects</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center py-8">
                <div className="animate-float bg-gradient-to-br from-primary/30 to-primary/10 size-24 rounded-2xl flex items-center justify-center">
                  <Star className="h-10 w-10 text-primary" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Gradient Animation */}
          <motion.div variants={item}>
            <Card>
              <CardHeader>
                <CardTitle>Gradient Animation</CardTitle>
                <CardDescription>Dynamic color transitions</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center py-8">
                <div className="animate-gradient-shift bg-gradient-premium size-24 rounded-2xl flex items-center justify-center bg-[size:400%_400%]">
                  <Zap className="h-10 w-10 text-white" />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </section>

      <section>
        <h2 className="premium-text text-3xl font-bold mb-8">Premium Avatars & Table</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Premium Avatars */}
          <Card>
            <CardHeader>
              <CardTitle>Premium Avatars</CardTitle>
              <CardDescription>Enhanced avatar components with status indicators</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-6 py-4">
                <div className="flex flex-col items-center gap-2">
                  <PremiumAvatar 
                    initials="JD" 
                    status="online"
                    size="lg" 
                  />
                  <span className="text-sm">Online</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <PremiumAvatar 
                    initials="AB" 
                    status="busy" 
                    size="lg"
                  />
                  <span className="text-sm">Busy</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <PremiumAvatar 
                    initials="CD" 
                    status="away" 
                    size="lg"
                  />
                  <span className="text-sm">Away</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <PremiumAvatar 
                    initials="EF" 
                    status="offline" 
                    size="lg"
                  />
                  <span className="text-sm">Offline</span>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <PremiumAvatar 
                    initials="VIP" 
                    status="premium" 
                    size="lg"
                  />
                  <span className="text-sm">Premium</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Animated Table */}
          <Card>
            <CardHeader>
              <CardTitle>Animated Table</CardTitle>
              <CardDescription>Table with smooth row animations</CardDescription>
            </CardHeader>
            <CardContent>
              <AnimatedTable>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <AnimatedTableBody>
                  {[
                    { name: "John Doe", role: "Developer", status: "Active" },
                    { name: "Jane Smith", role: "Designer", status: "Away" },
                    { name: "Bob Johnson", role: "Manager", status: "Offline" },
                    { name: "Alice Brown", role: "Marketing", status: "Active" },
                  ].map((item, index) => (
                    <AnimatedTableRow key={item.name} index={index}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.role}</TableCell>
                      <TableCell>
                        <Badge variant={item.status === "Active" ? "default" : item.status === "Away" ? "outline" : "secondary"}>
                          {item.status}
                        </Badge>
                      </TableCell>
                    </AnimatedTableRow>
                  ))}
                </AnimatedTableBody>
              </AnimatedTable>
            </CardContent>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="premium-text text-3xl font-bold mb-8">Activity Feed & Stats</h2>
        
        <Card>
          <CardHeader>
            <CardTitle>Activity Feed</CardTitle>
            <CardDescription>Animated activity feed with premium styling</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { 
                  icon: <Mail />, 
                  title: "New message received", 
                  description: "You have a new message from John Doe", 
                  time: "5 minutes ago",
                  badge: "New" 
                },
                { 
                  icon: <Users />, 
                  title: "Team meeting scheduled", 
                  description: "Weekly sync at 2:00 PM tomorrow", 
                  time: "1 hour ago",
                  badge: "Calendar" 
                },
                { 
                  icon: <Star />, 
                  title: "Project milestone reached", 
                  description: "UI design phase completed successfully", 
                  time: "Yesterday",
                  badge: "Achievement" 
                },
              ].map((item, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 * index, duration: 0.3 }}
                  className="flex items-center gap-4 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex-shrink-0">
                    <div className="size-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                      <span className="h-5 w-5 text-primary">
                        {item.icon}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 space-y-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <div className="font-medium truncate">
                        {item.title}
                      </div>
                      <Badge variant="outline" className="ml-auto flex-shrink-0">
                        {item.badge}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {item.description}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.time}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="premium-text text-3xl font-bold mb-8">3D Financial Interface</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 3D Credit Card */}
          <motion.div 
            initial={{ rotateY: 10, rotateX: 10 }}
            animate={{ 
              rotateY: [10, -10, 10],
              rotateX: [10, -10, 10],
            }}
            transition={{ 
              duration: 12, 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            className="perspective-1000"
          >
            <div className="premium-card bg-gradient-to-br from-slate-900 to-slate-800 text-white p-8 h-64 flex flex-col justify-between preserve-3d shadow-xl">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-sm opacity-70 mb-1">Balance</div>
                  <div className="text-3xl font-bold">$14,020.44</div>
                </div>
                <div className="text-xl font-mono tracking-widest">HRTBT</div>
              </div>
              
              <div className="font-mono tracking-widest text-lg">
                <div className="flex gap-4">
                  <span>5303</span>
                  <span>6084</span>
                </div>
                <div className="flex gap-4 mt-1">
                  <span>2402</span>
                  <span>3649</span>
                </div>
              </div>
              
              <div className="flex justify-between items-end">
                <div className="text-xs opacity-70">
                  <div>Credit limit</div>
                  <div>$220 / $1000</div>
                </div>
                <div className="text-xs opacity-70">09/24</div>
              </div>
              
              <div className="absolute bottom-0 left-0 right-0 h-1">
                <div className="h-full w-1/5 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500"></div>
              </div>
              
              <div className="absolute -bottom-6 -right-6 size-24 rounded-full bg-gradient-to-br from-purple-500/20 to-slate-800/5 blur-xl"></div>
            </div>
          </motion.div>
          
          {/* Circular Stats */}
          <div className="glass-effect p-8 rounded-xl">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center">
                <Button variant="ghost" size="icon" className="rounded-full">
                  <ChevronRight className="h-5 w-5 rotate-180" />
                </Button>
                <h3 className="text-xl font-semibold ml-2">Statistics</h3>
              </div>
              <div className="text-sm text-muted-foreground">
                Last 30 days <ChevronRight className="inline h-4 w-4 ml-1" />
              </div>
            </div>
            
            <div className="relative flex justify-center">
              <div className="relative size-48">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  {/* Background circle */}
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="40" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="10" 
                    strokeOpacity="0.1"
                  />
                  
                  {/* Progress segment */}
                  <circle 
                    cx="50" 
                    cy="50" 
                    r="40" 
                    fill="none" 
                    stroke="#f97316" 
                    strokeWidth="10" 
                    strokeDasharray="69.1 251.4"
                    strokeDashoffset="0" 
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.6 }}
                    className="flex flex-col items-center"
                  >
                    <div className="flex items-center justify-center size-10 bg-orange-500 rounded-full mb-1">
                      <motion.div 
                        whileHover={{ rotate: 360 }} 
                        transition={{ duration: 1 }}
                      >
                        <PieChart className="h-5 w-5 text-white" />
                      </motion.div>
                    </div>
                    <div className="text-xl font-bold">22%</div>
                  </motion.div>
                </div>
              </div>
            </div>
            
            {/* Category breakdown */}
            <div className="mt-8">
              <div className="flex items-center justify-between p-3 pl-4 bg-white/5 rounded-lg mt-4">
                <div className="flex items-center">
                  <Coffee className="h-5 w-5 mr-3 text-orange-500" />
                  <span>Restaurants</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>25%</span>
                  <span className="text-lg font-medium">$1593.58</span>
                </div>
              </div>
            </div>
            
            {/* Action buttons */}
            <div className="flex justify-between gap-4 mt-8">
              <Button variant="ghost" size="icon" className="border border-border h-12 w-12 rounded-xl">
                <motion.div whileHover={{ rotate: 5, scale: 1.05 }}>
                  <CreditCard className="h-5 w-5" />
                </motion.div>
              </Button>
              <Button variant="ghost" size="icon" className="border border-border h-12 w-12 rounded-xl">
                <motion.div whileHover={{ y: -2 }}>
                  <ArrowUpRight className="h-5 w-5" />
                </motion.div>
              </Button>
              <Button variant="ghost" size="icon" className="border border-border h-12 w-12 rounded-xl">
                <motion.div whileHover={{ scale: 1.2 }}>
                  <BarChart4 className="h-5 w-5" />
                </motion.div>
              </Button>
              <Button variant="ghost" size="icon" className="border border-border h-12 w-12 rounded-xl">
                <Star className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>
      
      <section className="mt-16">
        <h2 className="premium-text text-3xl font-bold mb-8">3D Email Component</h2>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8"
        >
          {/* 3D Email Inbox Card */}
          <div className="premium-card p-6 relative overflow-visible">
            <div className="absolute -top-6 -right-6 size-28 rounded-full bg-gradient-to-br from-primary/30 to-purple-500/5 blur-2xl pointer-events-none"></div>
            
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" />
              <span>Premium Inbox</span>
            </h3>
            
            <div className="space-y-3">
              {[
                { sender: "Alex Thompson", subject: "Project Update", time: "10:35 AM", unread: true },
                { sender: "Marketing Team", subject: "Q3 Campaign Results", time: "Yesterday", unread: false },
                { sender: "Support Desk", subject: "Your ticket has been resolved", time: "2 days ago", unread: false },
              ].map((email, index) => (
                <motion.div
                  key={index}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 * index }}
                  whileHover={{ 
                    x: 5, 
                    boxShadow: "0 10px 20px rgba(0, 0, 0, 0.1)",
                    scale: 1.02
                  }}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${email.unread ? 'bg-primary/5 border-primary/20' : 'bg-card hover:bg-accent/5'} cursor-pointer`}
                >
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className={email.unread ? 'bg-primary/20 text-primary' : ''}>
                      {email.sender.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center">
                      <p className={`text-sm ${email.unread ? 'font-semibold' : ''}`}>{email.sender}</p>
                      <span className="text-xs text-muted-foreground">{email.time}</span>
                    </div>
                    <p className={`text-sm truncate ${email.unread ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                      {email.subject}
                    </p>
                  </div>
                  {email.unread && (
                    <div className="size-2 rounded-full bg-primary flex-shrink-0"></div>
                  )}
                </motion.div>
              ))}
            </div>
            
            <div className="mt-4 flex justify-end">
              <Button variant="premium" size="sm">
                View All Messages
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
          
          {/* 3D Compose Email Component */}
          <div className="premium-card p-6 relative overflow-visible">
            <div className="absolute -bottom-6 -left-6 size-28 rounded-full bg-gradient-to-tr from-purple-500/30 to-primary/5 blur-2xl pointer-events-none"></div>
            
            <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span>Premium Composer</span>
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm" className="text-sm font-normal">To:</Button>
                <div className="flex-1 border-b pb-1 focus-within:border-primary transition-colors">
                  <input 
                    type="text" 
                    placeholder="Recipients..." 
                    className="outline-none bg-transparent w-full" 
                    defaultValue="business@example.com"
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm" className="text-sm font-normal">Subject:</Button>
                <div className="flex-1 border-b pb-1 focus-within:border-primary transition-colors">
                  <input 
                    type="text" 
                    placeholder="Add a subject..." 
                    className="outline-none bg-transparent w-full" 
                    defaultValue="Proposal for Q4 Marketing Strategy" 
                  />
                </div>
              </div>
              
              <div className="relative mt-4 rounded-md border min-h-[140px] focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all p-3">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="placeholder-content text-muted-foreground"
                >
                  <p>Dear Marketing Team,</p>
                  <p className="mt-2">I&apos;ve prepared a detailed proposal for our Q4 marketing strategy. The document outlines our key objectives, target audiences, and proposed budget allocation for the upcoming campaigns.</p>
                  <p className="mt-2">Looking forward to discussing this during our meeting on Friday.</p>
                  <p className="mt-4">Best regards,<br />Alex</p>
                </motion.div>
              </div>
              
              <div className="mt-2 flex justify-between">
                <div className="flex space-x-2">
                  <Button variant="outline" size="sm">
                    <Paperclip className="h-4 w-4 mr-1" />
                    Attach
                  </Button>
                  <Button variant="outline" size="sm">Save Draft</Button>
                </div>
                <Button variant="premium" size="sm">
                  Send Now
                  <ArrowUpRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </section>
    </div>
  );
} 