import { Component, OnInit, Input, AfterViewInit, Injectable } from '@angular/core';
import { castToPromise } from './../services/utilities';
import { FilterService } from '../services/filter.service';
import { SortService } from './../services/sort.service';
import { Column, GridOption } from './../models';

@Component({
  selector: 'slick-pagination',
  templateUrl: './slick-pagination.component.html'
})
@Injectable()
export class SlickPaginationComponent implements AfterViewInit, OnInit {
  private _gridPaginationOptions: GridOption;
  private _isFirstRender = true;

  @Input()
  set gridPaginationOptions(gridPaginationOptions: GridOption) {
    this._gridPaginationOptions = gridPaginationOptions;
    if (this._isFirstRender || !gridPaginationOptions || !gridPaginationOptions.pagination || (gridPaginationOptions.pagination.totalItems !== this.totalItems)) {
      this.refreshPagination();
      this._isFirstRender = false;
    }
  }
  get gridPaginationOptions(): GridOption {
    return this._gridPaginationOptions;
  }
  @Input() grid: any;
  dataFrom = 1;
  dataTo = 1;
  itemsPerPage;
  pageCount = 0;
  pageNumber = 1;
  totalItems = 0;
  paginationCallback: Function;
  paginationPageSizes = [25, 75, 100];
  fromToParams: any = { from: this.dataFrom, to: this.dataTo, totalItems: this.totalItems };

  constructor(private filterService: FilterService, private sortService: SortService) { }

  ngOnInit() {
  }

  ngAfterViewInit() {
    this._gridPaginationOptions = this._gridPaginationOptions;
    if (!this._gridPaginationOptions || !this._gridPaginationOptions.pagination || (this._gridPaginationOptions.pagination.totalItems !== this.totalItems)) {
      this.refreshPagination();
    }

    // Subscribe to Event Emitter of Filter & Sort changed, go back to page 1 when that happen
    this.filterService.onFilterChanged.subscribe((data) => {
      this.refreshPagination(true);
    });
    this.sortService.onSortChanged.subscribe((data) => {
      this.refreshPagination(true);
    });
  }

  ceil(number: number) {
    return Math.ceil(number);
  }

  changeToFirstPage(event: any) {
    this.pageNumber = 1;
    this.onPageChanged(event, this.pageNumber);
  }

  changeToLastPage(event: any) {
    this.pageNumber = this.pageCount;
    this.onPageChanged(event, this.pageNumber);
  }

  changeToNextPage(event: any) {
    if (this.pageNumber < this.pageCount) {
      this.pageNumber++;
      this.onPageChanged(event, this.pageNumber);
    }
  }

  changeToPreviousPage(event: any) {
    if (this.pageNumber > 0) {
      this.pageNumber--;
      this.onPageChanged(event, this.pageNumber);
    }
  }

  onChangeItemPerPage(event: any) {
    const itemsPerPage = +event.target.value;
    this.pageCount = Math.ceil(this.totalItems / itemsPerPage);
    this.pageNumber = 1;
    this.itemsPerPage = itemsPerPage;
    this.onPageChanged(event, this.pageNumber);
  }

  refreshPagination(isPageNumberReset?: boolean) {
    const backendApi = this._gridPaginationOptions.backendServiceApi || this._gridPaginationOptions.onBackendEventApi;
    if (!backendApi || !backendApi.service || !backendApi.process) {
      throw new Error(`BackendServiceApi requires at least a "process" function and a "service" defined`);
    }

    if (this._gridPaginationOptions && this._gridPaginationOptions.pagination) {
      // set the number of items per page if not already set
      if (!this.itemsPerPage) {
        this.itemsPerPage = +(backendApi['options'] && backendApi['options'].paginationOptions && backendApi['options'].paginationOptions.first) ? backendApi['options'].paginationOptions.first : this._gridPaginationOptions.pagination.pageSize;
      }

      // if totalItems changed, we should always go back to the first page and recalculation the From-To indexes
      if (isPageNumberReset || this.totalItems !== this._gridPaginationOptions.pagination.totalItems) {
        this.pageNumber = 1;
        this.recalculateFromToIndexes();

        // also reset the "offset" of backend service
        backendApi.service.resetPaginationOptions();
      }

      // calculate and refresh the multiple properties of the pagination UI
      this.paginationPageSizes = this._gridPaginationOptions.pagination.pageSizes;
      this.totalItems = this._gridPaginationOptions.pagination.totalItems;
      this.dataTo = this.itemsPerPage;
    }
    this.pageCount = Math.ceil(this.totalItems / this.itemsPerPage);
  }

  async onPageChanged(event?: Event, pageNumber?: number) {
    this.recalculateFromToIndexes();

    const backendApi = this._gridPaginationOptions.backendServiceApi || this._gridPaginationOptions.onBackendEventApi;
    if (!backendApi || !backendApi.service || !backendApi.process) {
      throw new Error(`BackendServiceApi requires at least a "process" function and a "service" defined`);
    }

    if (this.dataTo > this.totalItems) {
      this.dataTo = this.totalItems;
    }
    if (backendApi) {
      const itemsPerPage = +this.itemsPerPage;

      if (backendApi.preProcess) {
        backendApi.preProcess();
      }

      const query = backendApi.service.onPaginationChanged(event, { newPage: pageNumber, pageSize: itemsPerPage });

      // the process could be an Observable (like HttpClient) or a Promise
      // in any case, we need to have a Promise so that we can await on it (if an Observable, convert it to Promise)
      const observableOrPromise = backendApi.process(query);
      const processResult = await castToPromise(observableOrPromise);

      // from the result, call our internal post process to update the Dataset and Pagination info
      if (processResult && backendApi.internalPostProcess) {
        backendApi.internalPostProcess(processResult);
      }

      // send the response process to the postProcess callback
      if (backendApi.postProcess) {
        backendApi.postProcess(processResult);
      }
    } else {
      throw new Error('Pagination with a backend service requires "onBackendEventApi" to be defined in your grid options');
    }
  }

  recalculateFromToIndexes() {
    this.dataFrom = (this.pageNumber * this.itemsPerPage) - this.itemsPerPage + 1;
    this.dataTo = (this.pageNumber * this.itemsPerPage);
  }
}