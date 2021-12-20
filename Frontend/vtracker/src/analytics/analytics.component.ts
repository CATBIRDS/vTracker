import { Component, Injectable, Input, ViewChildren, QueryList } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ChartConfiguration, ChartEvent, ChartType } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

import { vtuberService } from 'src/api/service';

@Component({
  selector: 'pm-analytics',
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.css'],
  providers: [vtuberService]
})

@Injectable()
export class AnalyticsComponent {
    @Input() pageTitle: string;
    @Input() monthViewOptions: ChartConfiguration['options'];
    @Input() dayViewOptions: ChartConfiguration['options'];
    @Input() monthTimeOptions: ChartConfiguration['options'];
    @Input() dayTimeOptions: ChartConfiguration['options'];

    @Input() monthViewData: ChartConfiguration['data'];
    @Input() dayViewData: ChartConfiguration['data'];
    @Input() monthTimeData: ChartConfiguration['data'];
    @Input() dayTimeData: ChartConfiguration['data'];
    
    lineChartType: ChartType = 'line';
    // Storage for the history.json data. Not a true cache, serves to prevent multiple requests on a single page load. Unga bunga.
    cache: any = {};

    // Debug cache
    dummycache: any = {
        'kazuya': {
            '2021' : {
                'October': {
                    'daily_time': Array.from({length: 31}, () => Math.floor(Math.random() * 4000)),
                    'daily_view_avg': Array.from({length: 31}, () => Math.floor(Math.random() * 400)),
                    'monthly_time_avg': Math.floor(Math.random() * 400),
                    'monthly_view_avg': Math.floor(Math.random() * 4000)
                },
                'November': {
                    'daily_time': Array.from({length: 31}, () => Math.floor(Math.random() * 4000)),
                    'daily_view_avg': Array.from({length: 31}, () => Math.floor(Math.random() * 400)),
                    'monthly_time_avg': Math.floor(Math.random() * 400),
                    'monthly_view_avg': Math.floor(Math.random() * 4000)
                },
                'December': {
                    'daily_time': Array.from({length: 31}, () => Math.floor(Math.random() * 4000)),
                    'daily_view_avg': Array.from({length: 31}, () => Math.floor(Math.random() * 400)),
                    'monthly_time_avg': Math.floor(Math.random() * 400),
                    'monthly_view_avg': Math.floor(Math.random() * 4000)
                }
            },
        },
        'bingus': {
            '2021' : {
                'October': {
                    'daily_time': Array.from({length: 31}, () => Math.floor(Math.random() * 4000)),
                    'daily_view_avg': Array.from({length: 31}, () => Math.floor(Math.random() * 400)),
                    'monthly_time_avg': Math.floor(Math.random() * 400),
                    'monthly_view_avg': Math.floor(Math.random() * 4000)
                },
                'November': {
                    'daily_time': Array.from({length: 31}, () => Math.floor(Math.random() * 4000)),
                    'daily_view_avg': Array.from({length: 31}, () => Math.floor(Math.random() * 400)),
                    'monthly_time_avg': Math.floor(Math.random() * 400),
                    'monthly_view_avg': Math.floor(Math.random() * 4000)
                },
                'December': {
                    'daily_time': Array.from({length: 31}, () => Math.floor(Math.random() * 4000)),
                    'daily_view_avg': Array.from({length: 31}, () => Math.floor(Math.random() * 400)),
                    'monthly_time_avg': Math.floor(Math.random() * 400),
                    'monthly_view_avg': Math.floor(Math.random() * 4000)
                }
            },
        }
    };

    // Storage for the data needed to generate charts for view and time stats, respectively.
    view: any = {}
    time: any = {}
    

    constructor(private route: ActivatedRoute, private vtubers:vtuberService) {
        

        this.monthViewData = { datasets: [], labels: [] };
        this.dayViewData = { datasets: [], labels: [] };
        this.monthTimeData = { datasets: [], labels: [] };
        this.dayTimeData = { datasets: [], labels: [] };

        this.monthViewOptions = {
            plugins: { title: { display: true, text: 'Average Monthly Views' } },
            elements: { line: { tension: 0.5 } },
            scales: { x: {}, 'y-axis-0': { position: 'left' }, 'y-axis-1': { position: 'right', grid: { color: '#ffffff33', }, ticks: { color: 'grey', } } },
        };
        this.dayViewOptions = {
            plugins: { title: { display: true, text: 'Average Daily Views' } },
            elements: { line: { tension: 0.5 } },
            scales: { x: {}, 'y-axis-0': { position: 'left' }, 'y-axis-1': { position: 'right', grid: { color: '#ffffff33', }, ticks: { color: 'grey', } } },
        };
        this.monthTimeOptions = {
            plugins: { title: { display: true, text: 'Average Stream Duration by Month' } },
            elements: { line: { tension: 0.5 } },
            scales: { x: {}, 'y-axis-0': { position: 'left' }, 'y-axis-1': { position: 'right', grid: { color: '#ffffff33', }, ticks: { color: 'grey', } } },
        };
        this.dayTimeOptions = {
            plugins: { title: { display: true, text: 'Stream Duration by Day' } },
            elements: { line: { tension: 0.5 } },
            scales: { x: {}, 'y-axis-0': { position: 'left' }, 'y-axis-1': { position: 'right', grid: { color: '#ffffff33', }, ticks: { color: 'grey', } } },
        };

        this.pageTitle = 'Analytics';
    }

    @ViewChildren(BaseChartDirective) charts?: QueryList<BaseChartDirective>;

    getPastelColor(){ 
        return "hsla(" + 360 * Math.random() + ',' +
                   (25 + 70 * Math.random()) + '%,' + 
                   (85 + 10 * Math.random()) + '%, 1)'; 
    }

    generateDataSet(data: any, type: string, scope: string, vtuber: string | null, mode: string = 'replace') {
        if (vtuber === null) {
            return;
        }
        let color = this.getPastelColor();
        let dataset = [];
        let labels = [];
        console.log(vtuber)
        switch(scope) {
            case 'month':
                for (let month in data[vtuber]) {
                    if (month != 'daily') {
                        dataset.push(this.view[vtuber][month][0]);
                        labels.push(month);
                    }
                }
                if (type == 'view') {
                    this.monthViewData.datasets.push(
                        {
                            data: dataset,
                            label: vtuber,
                            backgroundColor: color.replace('1)', '0.2)'),
                            borderColor: color,
                            pointBackgroundColor: color.replace('1)', '0.2)'),
                            pointBorderColor: color,
                            pointHoverBackgroundColor: '#fff',
                            pointHoverBorderColor: '#fff',
                            fill: 'origin',
                        }
                    );
                    this.monthViewData.labels = labels;
                }
                else if (type == 'time') {
                    this.monthTimeData.datasets.push(
                        {
                            data: dataset,
                            label: vtuber,
                            backgroundColor: color.replace('1)', '0.2)'),
                            borderColor: color,
                            pointBackgroundColor: color.replace('1)', '0.2)'),
                            pointBorderColor: color,
                            pointHoverBackgroundColor: '#fff',
                            pointHoverBorderColor: '#fff',
                            fill: 'origin',
                        }
                    );
                    this.monthTimeData.labels = labels;
                }
                this.charts?.toArray().forEach(chart => {chart.update()});
                break;
            case 'day':
                dataset = data[vtuber]['daily'][Object.keys(data[vtuber]['daily'])[0]]
                for (let day in dataset) {
                    labels.push(day);
                }
                if (type == 'view') {
                    this.dayViewData.datasets.push(
                        {
                            data: dataset,
                            label: vtuber,
                            backgroundColor: color.replace('1)', '0.2)'),
                            borderColor: color,
                            pointBackgroundColor: color.replace('1)', '0.2)'),
                            pointBorderColor: color,
                            pointHoverBackgroundColor: '#fff',
                            pointHoverBorderColor: '#fff',
                            fill: 'origin',
                        }
                    );
                    this.dayViewData.labels = labels;
                }
                else if (type == 'time') {
                    this.dayTimeData.datasets.push(
                        {
                            data: dataset,
                            label: vtuber,
                            backgroundColor: color.replace('1)', '0.2)'),
                            borderColor: color,
                            pointBackgroundColor: color.replace('1)', '0.2)'),
                            pointBorderColor: color,
                            pointHoverBackgroundColor: '#fff',
                            pointHoverBorderColor: '#fff',
                            fill: 'origin',
                        }
                    );
                    this.dayTimeData.labels = labels;
                }
                this.charts?.toArray().forEach(chart => {chart.update()});
                break;
            default:
                this.charts?.toArray().forEach(chart => {chart.update()});
                break;
        }
    }

    firstRun(username: string | null) {
        if (username === null) return;
        if (this.cache != undefined)
        {
            // Get Data
            this.vtubers.getHist().toPromise().then(data => {
                //this.cache = data;
                // DEBUG
                this.cache = this.dummycache;
                let vtuber: any;
                for (let streamer in this.cache) {
                    if (streamer == username) {
                        vtuber = this.cache[streamer];
                    }
                }
                // Sort data
                for (let year in vtuber) {
                    for (let month in vtuber[year]) {
                        let monthInt = new Date(Date.parse(month +" 1, 2012")).getMonth()+1;
                        let id = monthInt.toString() + '/' + year.toString();
                        // Set up pseudo-dictionaries
                        this.view[vtuber] = { [month]: [], ['daily']: {} };
                        this.time[vtuber] = { [month]: [], ['daily']: {} };
                        // Plug in data
                        this.view[vtuber][month].push(vtuber[year][month]['monthly_view_avg']);
                        this.view[vtuber]['daily'][id] = vtuber[year][month]['daily_view_avg'];
                        this.time[vtuber][month].push(vtuber[year][month]['monthly_time_avg']);
                        this.time[vtuber]['daily'][id] = vtuber[year][month]['daily_time'];
                    }
                }
                // Generate datasets
                this.generateDataSet(this.view, 'view', 'month', username);
                this.generateDataSet(this.view, 'view', 'day', vtuber);
                this.generateDataSet(this.time, 'time', 'month', username);
                this.generateDataSet(this.time, 'time', 'day', vtuber);

                console.log(this.cache)
            });
        }
    }

    ngOnInit() {
        const id = this.route.snapshot.paramMap.get('id');
        this.pageTitle += ': ' + id;
        this.firstRun(id);
    }

    public chartHovered({ event, active }: { event?: ChartEvent, active?: {}[] }): void {
        //console.log(event, active);
    }
    public chartClicked({ event, active }: { event?: ChartEvent, active?: {}[] }): void {
        console.log(event, active);
    }

}
