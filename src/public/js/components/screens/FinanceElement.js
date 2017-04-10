import { Map as ImmutableMap } from 'immutable';

import React from 'react';
import { connect } from 'react-redux';
import { format } from 'currency-formatter';

import { scaleLinear } from 'd3-scale';
import { min, max, sum } from 'd3-array';

import {m52ToAggregated, hierarchicalAggregated}  from '../../../../shared/js/finance/memoized';
import {default as visit, flattenTree} from '../../../../shared/js/finance/visitHierarchical.js';
import navigationTree from '../../navigationTree';
import { EXPENDITURES, REVENUE } from '../../../../shared/js/finance/constants';

import D3Axis from '../D3Axis';

/*
    In this component, there are several usages of dangerouslySetInnerHTML.

    In the context of the public dataviz project, the strings being used are HTML generated by 
    a markdown parser+renderer. This part is considered trusted enough.

    The content being passed to the markdown parser is created and reviewed by the project team and likely
    by the communication team at the Département de la Gironde. So this content is very very unlikely to ever
    contain anything that could cause any harm.

    For these reasons, the usages of dangerouslySetInnerHTML are fine.
*/

/*

interface FinanceElementProps{
    contentId: string,
    amount, // amount of this element
    aboveTotal, // amount of the element in the above category
    topTotal // amount of total expenditures or revenue
    texts: FinanceElementTextsRecord,

    // the partition will be displayed in the order it's passed. Sort beforehand if necessary
    partition: Array<{
        contentId: string,
        partAmount: number,
        texts: FinanceElementTextsRecord,
        url: string
    }>
}

*/

const WIDTH = 1000;
const HEIGHT = 570;

const HEIGHT_PADDING = 30;

export function FinanceElement({contentId, amount, parent, top, texts, partition, year, amountsByYear, urls}) {
    const label = texts && texts.get('label');
    const atemporalText = texts && texts.get('atemporal');
    //const yearText = texts && texts.get('byYear') && texts.get('byYear').get(year);

    const years = amountsByYear.keySeq().toJS();
    const amounts = amountsByYear.valueSeq().toJS();

    const columnAndMarginWidth = WIDTH/(years.length+1)
    const columnMargin = columnAndMarginWidth/4;
    const columnWidth = columnAndMarginWidth - columnMargin;

    const yearScale = scaleLinear()
        .domain([min(years), max(years)])
        .range([columnAndMarginWidth/2, WIDTH-columnAndMarginWidth/2]);

    const maxAmounts = max(amounts);

    const yAxisAmountScale = scaleLinear()
        .domain([0, maxAmounts])
        .range([HEIGHT - HEIGHT_PADDING, HEIGHT_PADDING]);
    const yRange = yAxisAmountScale.range()[0] - yAxisAmountScale.range()[1];

    const ticks = yAxisAmountScale.ticks(5);

    const rectAmountScale = scaleLinear()
        .domain([0, maxAmounts])
        .range([0, yRange]);

    return React.createElement('article', {className: 'finance-element'}, 
        React.createElement('h1', {className: label ? '' : 'missing', 'data-id': contentId}, 
            label,
            ' en ',
            year
        ), 
        React.createElement('h3', {}, format(amount, { code: 'EUR' })),
        
        React.createElement('div', {className: 'ratios'}, 
            parent ? React.createElement('div', {className: 'proportion-container'},
                React.createElement('div', {className: 'proportion', style: {width: 100*amount/parent.amount+'%'}}, 'Proportion relative à ', parent.label)
            ) : undefined,
            top ? React.createElement('div', {className: 'proportion-container'},
                React.createElement('div', {className: 'proportion', style: {width: 100*amount/top.amount+'%'}}, 'Proportion relative aux ', top.label, ' totales')
            ) : undefined
        ),

        atemporalText ? React.createElement('section', {className: 'atemporal', dangerouslySetInnerHTML: {__html: atemporalText}}) : undefined,

        React.createElement('h2', {}, 'Évolution sur ces dernières années'),
        React.createElement('svg', {width: WIDTH, height: HEIGHT},
            // x axis / years
            React.createElement(D3Axis, {className: 'x', tickData: 
                years.map(y => {
                    return {
                        transform: `translate(${yearScale(y)}, ${HEIGHT-HEIGHT_PADDING})`,
                        line: { x1 : 0, y1 : 0, x2 : 0, y2 : 0 }, 
                        text: {
                            x: 0, y: -10, 
                            dx: "-1.6em", dy: "2em", 
                            t: y
                        }
                        
                    }
                })
            }),
            // y axis / money amounts
            React.createElement(D3Axis, {className: 'y', tickData: ticks.map(tick => {
                return {
                    transform: `translate(0, ${yAxisAmountScale(tick)})`,
                    line: {
                        x1 : 0, y1 : 0, 
                        x2 : WIDTH, y2 : 0
                    }, 
                    text: {
                        x: 0, y: -10, 
                        dx: 0, dy: 0, 
                        t: (tick/1000000)+'M'
                    }
                    
                }
            })}),
            // content
            React.createElement('g', {className: 'content'},
                amountsByYear.entrySeq().toJS().map(([year, yearAmount]) => {
                    const height = rectAmountScale(yearAmount);
                    const y = HEIGHT - HEIGHT_PADDING - height;

                    return React.createElement('g', {transform: `translate(${yearScale(year)})`}, 
                        React.createElement('rect', {x: -columnWidth/2, y, width: columnWidth, height}),
                        React.createElement('text', {x: -columnWidth/2, y, dy: "1.5em", dx:"0.5em"}, (yearAmount/1000000).toFixed(1))
                    )
                })
            )
        ),
        
        //React.createElement('scatter-plot', {}, ''),
        //yearText ? React.createElement('h3', {}, "Considérations spécifiques à l'année ",year) : undefined,
        //yearText ? React.createElement('section', {dangerouslySetInnerHTML: {__html: yearText}}) : undefined,


        partition ? React.createElement('section', { className: 'partition'}, 
            partition.map(({contentId, partAmount, texts, url}) => {
                return React.createElement('a',
                    {
                        href: url
                    }, 
                    React.createElement('h1', {}, texts && texts.get('label') || contentId),
                    React.createElement('h2', {},
                        format(partAmount, { code: 'EUR' }),
                        ' ',
                        (100*partAmount/amount).toFixed(1)+'%'
                    ),
                    React.createElement('p', {dangerouslySetInnerHTML: {__html: atemporalText}})
                );
            })  
        ) : undefined 

    );
}



function makePartition(contentId, totalById, textsById){
    const childrenIds = navigationTree[contentId];

    return childrenIds ? childrenIds.map(childId => ({
        contentId: childId,
        partAmount: totalById.get(childId),
        texts: textsById.get(childId),
        url: '#!/finance-details/'+childId
    })) : undefined;
}



function makeElementById(hierAgg){
    let elementById = new ImmutableMap();

    flattenTree(hierAgg).forEach(aggHierNode => {
        elementById = elementById.set(aggHierNode.id, aggHierNode);
    });

    return elementById;
}

function makeChildToParent(hierAgg){
    const childToParent = new WeakMap();

    visit(hierAgg, e => {
        if(e.children){
            e.children.forEach(c => {
                childToParent.set(c, e);
            })
        }
    });

    return childToParent;
}


export default connect(
    state => {        
        const { m52InstructionByYear, textsById, breadcrumb, currentYear } = state;
        
        const m52Instruction = m52InstructionByYear.get(currentYear);
        const aggregated = m52Instruction && m52ToAggregated(m52Instruction);
        const hierAgg = m52Instruction && hierarchicalAggregated(aggregated);
        const childToParent = m52Instruction && makeChildToParent(hierAgg);
        
        const displayedContentId = breadcrumb.last();
        
        const elementById = (m52Instruction && makeElementById(hierAgg)) || new ImmutableMap();
        const element = elementById.get(displayedContentId);

        const expenseOrRevenue = element && element.id ? 
            // weak test. TODO : pick a stronger test
            (element.id.startsWith('D') ? EXPENDITURES : REVENUE) : 
            undefined;

        const amount = m52Instruction && element.total;

        const isDeepElement = element && element.id !== EXPENDITURES && element.id !== REVENUE;

        const parentElement = isDeepElement && childToParent.get(element);
        const topElement = isDeepElement && elementById.get(expenseOrRevenue);

        const amountsByYear = m52InstructionByYear.map(m52i => {
            return makeElementById(hierarchicalAggregated(m52ToAggregated(m52i))).get(displayedContentId).total;
        })

        return {
            contentId: displayedContentId, 
            amount,
            parent: parentElement && parentElement !== topElement && {
                amount: parentElement.total,
                label: textsById.get(parentElement.id).label
            },
            top: topElement && {
                amount: topElement.total,
                label: textsById.get(topElement.id).label
            },
            expenseOrRevenue,
            amountsByYear,
            texts: textsById.get(displayedContentId),
            partition: makePartition(displayedContentId, elementById.map(e => e.total), textsById),
            year: currentYear
        }

    },
    () => ({})
)(FinanceElement);