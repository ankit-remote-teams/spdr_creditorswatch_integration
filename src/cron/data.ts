import { SimproCustomerPaymentsType, SimproInvoiceType } from "../types/types";

export const simproInvoiceData: SimproInvoiceType[] = [
    {
        ID: 72769,
        Customer: {
            ID: 1601,
            CompanyName: "Elite New Homes ",
            GivenName: "",
            FamilyName: ""
        },
        Status: {
            ID: 21,
            Name: "Invoices : 91+ days overdue"
        },
        IsPaid: false,
        Stage: "Approved",
        Type: "ProgressInvoice",
        Total: {
            ExTax: 18404.18,
            IncTax: 20244.59,
            Tax: 1840.41,
            ReverseChargeTax: 0,
            AmountApplied: 20244.59,
            BalanceDue: 0,
        },
        DateIssued: "2024-02-29",
        DatePaid: "",
        DateCreated: "2024-02-29T09:58:17+11:00",
        LatePaymentFee: true,
        PaymentTerms: {
            Days: 14,
            Type: "Invoice",
            DueDate: "2024-03-14"
        },
    },
    // {
    //     ID: 81902,
    //     Customer: {
    //         ID: 2492,
    //         CompanyName: "Enable Group Pty Ltd ",
    //         GivenName: "",
    //         FamilyName: ""
    //     },
    //     Status: {
    //         ID: 19,
    //         Name: "Invoices : 31-60 days overdue"
    //     },
    //     Stage: "Approved",
    //     Type: "ProgressInvoice",
    //     Total: {
    //         ExTax: 31274.67,
    //         IncTax: 34402.14,
    //         Tax: 3127.47,
    //         ReverseChargeTax: 0,
    //         AmountApplied: 14402.14,
    //         BalanceDue: 20000
    //     },
    //     IsPaid: false,
    //     DateIssued: "2024-08-31",
    //     DatePaid: "",
    //     DateCreated: "2024-08-30T05:27:20+10:00",
    //     LatePaymentFee: true,
    //     PaymentTerms: {
    //         Days: 14,
    //         Type: "Invoice",
    //         DueDate: "2024-09-14"
    //     }
    // },
    // {
    //     ID: 81907,
    //     Customer: {
    //         ID: 2183,
    //         CompanyName: "Mann Construction & Development Pty Ltd T/As Morewell Homes",
    //         GivenName: "",
    //         FamilyName: ""
    //     },
    //     Status: {
    //         ID: 19,
    //         Name: "Invoices : 31-60 days overdue"
    //     },
    //     Stage: "Approved",
    //     Type: "ProgressInvoice",
    //     Total: {
    //         ExTax: 602,
    //         IncTax: 662.2,
    //         Tax: 60.2,
    //         ReverseChargeTax: 0,
    //         AmountApplied: 275,
    //         BalanceDue: 387.2
    //     },
    //     IsPaid: false,
    //     DateIssued: "2024-08-30",
    //     DatePaid: "",
    //     DateCreated: "2024-08-30T05:37:19+10:00",
    //     LatePaymentFee: true,
    //     PaymentTerms: {
    //         Days: 14,
    //         Type: "Invoice",
    //         DueDate: "2024-09-13"
    //     }
    // },
    // {
    //     ID: 71669,
    //     Customer: {
    //         ID: 508,
    //         CompanyName: "Ridgewater Property Group T/As Ridgewater Homes",
    //         GivenName: "",
    //         FamilyName: ""
    //     },
    //     Status: {
    //         ID: 21,
    //         Name: "Invoices : 91+ days overdue"
    //     },
    //     Stage: "Approved",
    //     Total: {
    //         ExTax: 9793.8,
    //         IncTax: 10773.18,
    //         Tax: 979.38,
    //         ReverseChargeTax: 0,
    //         AmountApplied: 8573.18,
    //         BalanceDue: 2200
    //     },
    //     IsPaid: false,
    //     DateIssued: "2024-01-31",
    //     DatePaid: "",
    //     DateCreated: "2024-01-31T12:23:11+11:00",
    //     LatePaymentFee: true,
    //     PaymentTerms: {
    //         Days: 30,
    //         Type: "Month",
    //         DueDate: "2024-03-01"
    //     },
    //     Type: "ProgressInvoice"
    // },
    // {
    //     ID: 74122,
    //     Customer: {
    //         ID: 508,
    //         CompanyName: "Ridgewater Property Group T/As Ridgewater Homes",
    //         GivenName: "",
    //         FamilyName: ""
    //     },
    //     Status: {
    //         ID: 21,
    //         Name: "Invoices : 91+ days overdue"
    //     },
    //     Stage: "Approved",
    //     Total: {
    //         ExTax: 400,
    //         IncTax: 440,
    //         Tax: 40,
    //         ReverseChargeTax: 0,
    //         AmountApplied: 254.63,
    //         BalanceDue: 185.37
    //     },
    //     IsPaid: false,
    //     DateIssued: "2024-04-05",
    //     DatePaid: "",
    //     DateCreated: "2024-04-05T10:11:43+11:00",
    //     LatePaymentFee: true,
    //     PaymentTerms: {
    //         Days: 30,
    //         Type: "Month",
    //         DueDate: "2024-05-30"
    //     },
    //     Type: "ProgressInvoice"
    // },
    // {
    //     ID: 68902,
    //     Customer: {
    //         ID: 1072,
    //         CompanyName: "Melbourne Developers ",
    //         GivenName: "",
    //         FamilyName: ""
    //     },
    //     Status: {
    //         ID: 22,
    //         Name: "Invoices : Fully-paid"
    //     },
    //     Stage: "Approved",
    //     Total: {
    //         ExTax: 14079.8,
    //         IncTax: 15487.78,
    //         Tax: 1407.98,
    //         ReverseChargeTax: 0,
    //         AmountApplied: 15487.78,
    //         BalanceDue: -177.81
    //     },
    //     IsPaid: false,
    //     DateIssued: "2023-10-31",
    //     DatePaid: "",
    //     DateCreated: "2023-10-31T07:59:37+11:00",
    //     LatePaymentFee: true,
    //     PaymentTerms: {
    //         Days: 14,
    //         Type: "Invoice",
    //         DueDate: "2023-11-14"
    //     },
    //     Type: "ProgressInvoice"
    // }
]


export const simproCustomerPaymentData: SimproCustomerPaymentsType[] = [
    {
        ID: 2114,
        Payment: {
            PaymentMethod: {
                ID: 77,
                Name: "CBA - ATC"
            },
            Status: "",
            DepositAccount: "1-1108",
            Date: "2024-08-12",
            FinanceCharge: 0,
            CheckNo: "",
            Details: "",
        },
        Invoices: [
            {
                Invoice: {
                    ID: 74076,
                    Customer: {
                        ID: 1601,
                        CompanyName: "Elite New Homes ",
                        GivenName: "",
                        FamilyName: ""
                    },
                },
                Amount: 3770.8
            },
            {
                Invoice: {
                    ID: 73397,
                    Customer: {
                        ID: 1601,
                        CompanyName: "Elite New Homes ",
                        GivenName: "",
                        FamilyName: ""
                    },
                },
                Amount: 2530.57
            },
            {
                Invoice: {
                    ID: 72769,
                    Customer: {
                        ID: 1601,
                        CompanyName: "Elite New Homes ",
                        GivenName: "",
                        FamilyName: ""
                    },
                },
                "Amount": 1244.59
            }
        ]
    },
    {
        ID: 20616,
        Payment: {
            PaymentMethod: {
                ID: 103,
                Name: "CBA - SPDR Grp"
            },
            Status: "",
            DepositAccount: "1-1106",
            Date: "2024-07-01",
            FinanceCharge: 0,
            CheckNo: "",
            Details: "",
        },
        Invoices: [
            {
                Invoice: {
                    ID: 72769,
                    Customer: {
                        ID: 1601,
                        CompanyName: "Elite New Homes ",
                        GivenName: "",
                        FamilyName: ""
                    },
                    Jobs: [
                        {
                            ID: 13141,
                            Site: {
                                ID: 11561,
                                Name: "60 Murray Street, Fawkner"
                            },
                            Comment: "",
                            Description: "",
                            Total: {
                                ExTax: 28886.22,
                                IncTax: 31774.84
                            }
                        }
                    ],
                    Currency: {
                        ID: "AUD",
                        Name: "Australian Dollar"
                    }
                },
                Amount: 5000
            }
        ]
    },
    {
        ID: 20408,
        Payment: {
            PaymentMethod: {
                ID: 77,
                Name: "CBA - ATC"
            },
            Status: "",
            DepositAccount: "1-1103",
            Date: "2024-06-21",
            FinanceCharge: 0,
            CheckNo: "",
            Details: "",
        },
        Invoices: [
            {
                Invoice: {
                    ID: 72769,
                    Customer: {
                        ID: 1601,
                        CompanyName: "Elite New Homes ",
                        GivenName: "",
                        FamilyName: ""
                    },
                    Jobs: [
                        {
                            ID: 13141,
                            Site: {
                                ID: 11561,
                                Name: "60 Murray Street, Fawkner"
                            },
                            Comment: "",
                            Description: "",
                            Total: {
                                ExTax: 28886.22,
                                IncTax: 31774.84
                            }
                        }
                    ],
                    Currency: {
                        ID: "AUD",
                        Name: "Australian Dollar"
                    }
                },
                Amount: 5000
            }
        ]
    },
    {
        ID: 20159,
        Payment: {
            PaymentMethod: {
                ID: 77,
                Name: "CBA - ATC"
            },
            Status: "",
            DepositAccount: "1-1103",
            Date: "2024-06-05",
            FinanceCharge: 0,
            CheckNo: "",
            Details: "",
        },
        Invoices: [
            {
                Invoice: {
                    ID: 72769,
                    Customer: {
                        ID: 1601,
                        CompanyName: "Elite New Homes ",
                        GivenName: "",
                        FamilyName: ""
                    },
                    Jobs: [
                        {
                            ID: 13141,
                            Site: {
                                ID: 11561,
                                Name: "60 Murray Street, Fawkner"
                            },
                            Comment: "",
                            Description: "",
                            Total: {
                                ExTax: 28886.22,
                                IncTax: 31774.84
                            }
                        }
                    ],
                    Currency: {
                        ID: "AUD",
                        Name: "Australian Dollar"
                    }
                },
                Amount: 4000
            }
        ]
    },
    {
        ID: 19625,
        Payment: {
            PaymentMethod: {
                ID: 77,
                Name: "CBA - ATC"
            },
            Status: "",
            DepositAccount: "1-1103",
            Date: "2024-05-06",
            FinanceCharge: 0,
            CheckNo: "",
            Details: "",
        },
        Invoices: [
            {
                Invoice: {
                    ID: 72769,
                    Customer: {
                        ID: 1601,
                        CompanyName: "Elite New Homes ",
                        GivenName: "",
                        FamilyName: ""
                    },
                    Jobs: [
                        {
                            ID: 13141,
                            Site: {
                                ID: 11561,
                                Name: "60 Murray Street, Fawkner"
                            },
                            Comment: "",
                            Description: "",
                            Total: {
                                ExTax: 28886.22,
                                IncTax: 31774.84
                            }
                        }
                    ],
                    Currency: {
                        ID: "AUD",
                        Name: "Australian Dollar"
                    }
                },
                Amount: 5000
            }
        ]
    },
    {
        ID: 21576,
        Payment: {
            PaymentMethod: {
                ID: 103,
                Name: "CBA - SPDR Grp"
            },
            Status: "",
            DepositAccount: "1-1106",
            Date: "2024-09-12",
            FinanceCharge: 0,
            CheckNo: "",
            Details: "",
        },
        Invoices: [
            {
                Invoice: {
                    ID: 81902,
                    Customer: {
                        ID: 2492,
                        CompanyName: "Enable Group Pty Ltd ",
                        GivenName: "",
                        FamilyName: ""
                    },
                    Jobs: [
                        {
                            ID: 13923,
                            Site: {
                                ID: 14347,
                                Name: "47 Dent Street, Glen Iris "
                            },
                            Comment: "",
                            Description: "",
                            Total: {
                                ExTax: 50796.44,
                                IncTax: 55876.09
                            }
                        }
                    ],
                    Currency: {
                        ID: "AUD",
                        Name: "Australian Dollar"
                    }
                },
                Amount: 14402.14
            }
        ]
    },
    {
        ID: 21963,
        Payment: {
            PaymentMethod: {
                ID: 103,
                Name: "CBA - SPDR Grp"
            },
            Status: "",
            DepositAccount: "1-1106",
            Date: "2024-08-30",
            FinanceCharge: 0,
            CheckNo: "",
            Details: "",
        },
        Invoices: [
            {
                Invoice: {
                    ID: 81907,
                    Customer: {
                        ID: 2183,
                        CompanyName: "Mann Construction & Development Pty Ltd T/As Morewell Homes",
                        GivenName: "",
                        FamilyName: ""
                    },
                    Jobs: [
                        {
                            ID: 13967,
                            Site: {
                                ID: 16595,
                                Name: "Lot 20645 No 15 Mound Avenue, Donnybrook "
                            },
                            Comment: "",
                            Description: "",
                            Total: {
                                ExTax: 602,
                                IncTax: 662.2
                            }
                        }
                    ],
                    Currency: {
                        ID: "AUD",
                        Name: "Australian Dollar"
                    }
                },
                Amount: 275
            }
        ]
    },
    {
        ID: 18111,
        Payment: {
            PaymentMethod: {
                ID: 77,
                Name: "CBA - ATC"
            },
            Status: "",
            DepositAccount: "1-1103",
            Date: "2023-12-20",
            FinanceCharge: 0,
            CheckNo: "",
            Details: "",
        },
        Invoices: [
            {
                Invoice: {
                    ID: 68902,
                    Customer: {
                        ID: 1072,
                        CompanyName: "Melbourne Developers ",
                        GivenName: "",
                        FamilyName: ""
                    },
                    Jobs: [
                        {
                            ID: 9608,
                            Site: {
                                ID: 11470,
                                Name: "23 Marilyn Street, Doncaster"
                            },
                            Comment: "",
                            Description: "",
                            Total: {
                                ExTax: 46977.29,
                                IncTax: 51675.02
                            }
                        }
                    ],
                    Currency: {
                        ID: "AUD",
                        Name: "Australian Dollar"
                    }
                },
                Amount: 15487.78
            }
        ]
    },
    {
        ID: 19340,
        Payment: {
            PaymentMethod: {
                ID: 77,
                Name: "CBA - ATC"
            },
            Status: "",
            DepositAccount: "1-1103",
            Date: "2024-04-18",
            FinanceCharge: 0,
            CheckNo: "",
            Details: "",
        },
        Invoices: [
            {
                Invoice: {
                    ID: 74122,
                    Customer: {
                        ID: 508,
                        CompanyName: "Ridgewater Property Group T/As Ridgewater Homes",
                        GivenName: "",
                        FamilyName: ""
                    },
                    Jobs: [
                        {
                            ID: 9989,
                            Site: {
                                ID: 12033,
                                Name: "Lot 2671 No 11 Aerial Way, Aintree "
                            },
                            Comment: "<div style=\"font-size: 10pt;\">Supply and install PVC to discharge sump overflows and outlet to atsmosphere (RHS Garage Pier)&nbsp;</div><div style=\"font-size: 10pt;\">&nbsp;</div><div style=\"font-size: 10pt;\">All material and labour included into quote.&nbsp;</div>",
                            Description: "<div style=\"font-size: 10pt;\">Supply and install PVC to discharge sump overflows and outlet to atsmosphere (RHS Garage Pier)&nbsp;</div><div style=\"font-size: 10pt;\">&nbsp;</div><div style=\"font-size: 10pt;\">All material and labour included into quote.&nbsp;</div>",
                            Total: {
                                ExTax: 13622,
                                IncTax: 14984.2
                            }
                        }
                    ],
                    Currency: {
                        ID: "AUD",
                        Name: "Australian Dollar"
                    }
                },
                Amount: 254.63
            }
        ]
    },
    {
        ID: 18527,
        Payment: {
            PaymentMethod: {
                ID: 77,
                Name: "CBA - ATC"
            },
            Status: "",
            DepositAccount: "1-1103",
            Date: "2024-02-08",
            FinanceCharge: 0,
            CheckNo: "",
            Details: "",
        },
        Invoices: [
            {
                Invoice: {
                    ID: 71759,
                    Customer: {
                        ID: 508,
                        CompanyName: "Ridgewater Property Group T/As Ridgewater Homes",
                        GivenName: "",
                        FamilyName: ""
                    },
                    Jobs: [
                        {
                            ID: 10152,
                            Site: {
                                ID: 12153,
                                Name: "Lot 617 No 4 Silvereye Street, Torquay "
                            },
                            Comment: "",
                            Description: "",
                            Total: {
                                ExTax: 14882,
                                IncTax: 16370.2
                            }
                        }
                    ],
                    Currency: {
                        ID: "AUD",
                        Name: "Australian Dollar"
                    }
                },
                Amount: 302.5
            },
            {
                Invoice: {
                    ID: 71743,
                    Customer: {
                        ID: 508,
                        CompanyName: "Ridgewater Property Group T/As Ridgewater Homes",
                        GivenName: "",
                        FamilyName: ""
                    },
                    Jobs: [
                        {
                            ID: 10523,
                            Site: {
                                ID: 12439,
                                Name: "Lot 2063 No 8 Rundle Court, Taylors Hill"
                            },
                            Comment: "",
                            Description: "",
                            Total: {
                                ExTax: 13676,
                                IncTax: 15043.6
                            }
                        }
                    ],
                    Currency: {
                        ID: "AUD",
                        Name: "Australian Dollar"
                    }
                },
                Amount: 1336.5
            },
            {
                Invoice: {
                    ID: 71694,
                    Customer: {
                        ID: 508,
                        CompanyName: "Ridgewater Property Group T/As Ridgewater Homes",
                        GivenName: "",
                        FamilyName: ""
                    },
                    Jobs: [
                        {
                            ID: 10152,
                            Site: {
                                ID: 12153,
                                Name: "Lot 617 No 4 Silvereye Street, Torquay "
                            },
                            Comment: "",
                            Description: "",
                            Total: {
                                ExTax: 14882,
                                IncTax: 16370.2
                            }
                        }
                    ],
                    Currency: {
                        ID: "AUD",
                        Name: "Australian Dollar"
                    }
                },
                Amount: 1197.02
            },
            {
                Invoice: {
                    ID: 71669,
                    Customer: {
                        ID: 508,
                        CompanyName: "Ridgewater Property Group T/As Ridgewater Homes",
                        GivenName: "",
                        FamilyName: ""
                    },
                    Jobs: [
                        {
                            ID: 10152,
                            Site: {
                                ID: 12153,
                                Name: "Lot 617 No 4 Silvereye Street, Torquay "
                            },
                            Comment: "",
                            Description: "",
                            Total: {
                                ExTax: 14882,
                                IncTax: 16370.2
                            }
                        }
                    ],
                    Currency: {
                        ID: "AUD",
                        Name: "Australian Dollar"
                    }
                },
                Amount: 8573.18
            }
        ]
    }
]